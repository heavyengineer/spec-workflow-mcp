import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ToolContext, ToolResponse } from '../types.js';
import { ApprovalStorage } from '../dashboard/approval-storage.js';
import { join } from 'path';
import { validateProjectPath } from '../core/path-utils.js';

export const approvalsTool: Tool = {
  name: 'approvals',
  description: `Manage approval requests through the dashboard interface.

# Instructions
Use this tool to request, check status, or delete approval requests. The action parameter determines the operation:
- 'request': Create a new approval request after creating each document
- 'status': Check the current status of an approval request
- 'delete': Clean up completed approval requests

CRITICAL: Only provide filePath parameter for requests - the dashboard reads files directly. Never include document content. Wait for user to review and approve before continuing.`,
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['request', 'status', 'delete'],
        description: 'The action to perform: request, status, or delete'
      },
      projectPath: {
        type: 'string',
        description: 'Absolute path to the project root (required for request, optional for status/delete)'
      },
      approvalId: {
        type: 'string',
        description: 'The ID of the approval request (required for status and delete actions)'
      },
      title: {
        type: 'string',
        description: 'Brief title describing what needs approval (required for request action)'
      },
      filePath: {
        type: 'string',
        description: 'Path to the file that needs approval, relative to project root (required for request action)'
      },
      type: {
        type: 'string',
        enum: ['document', 'action'],
        description: 'Type of approval request - "document" for content approval, "action" for action approval (required for request)'
      },
      category: {
        type: 'string',
        enum: ['spec', 'steering'],
        description: 'Category of the approval request - "spec" for specifications, "steering" for steering documents (required for request)'
      },
      categoryName: {
        type: 'string',
        description: 'Name of the spec or "steering" for steering documents (required for request)'
      }
    },
    required: ['action']
  }
};

export async function approvalsHandler(
  args: {
    action: 'request' | 'status' | 'delete';
    projectPath?: string;
    approvalId?: string;
    title?: string;
    filePath?: string;
    type?: 'document' | 'action';
    category?: 'spec' | 'steering';
    categoryName?: string;
  },
  context: ToolContext
): Promise<ToolResponse> {
  switch (args.action) {
    case 'request':
      return handleRequestApproval(args as any, context);
    case 'status':
      return handleGetApprovalStatus(args as any, context);
    case 'delete':
      return handleDeleteApproval(args as any, context);
    default:
      return {
        success: false,
        message: `Unknown action: ${args.action}. Use 'request', 'status', or 'delete'.`
      };
  }
}

async function handleRequestApproval(
  args: { projectPath: string; title: string; filePath: string; type: 'document' | 'action'; category: 'spec' | 'steering'; categoryName: string },
  context: ToolContext
): Promise<ToolResponse> {
  // Validate required fields for request action
  if (!args.projectPath || !args.title || !args.filePath || !args.type || !args.category || !args.categoryName) {
    return {
      success: false,
      message: 'Missing required fields for request action. Required: projectPath, title, filePath, type, category, categoryName'
    };
  }

  try {
    // Validate and resolve project path
    const validatedProjectPath = await validateProjectPath(args.projectPath);

    const approvalStorage = new ApprovalStorage(validatedProjectPath);
    await approvalStorage.start();

    const approvalId = await approvalStorage.createApproval(
      args.title,
      args.filePath,
      args.category,
      args.categoryName,
      args.type
    );

    await approvalStorage.stop();

    return {
      success: true,
      message: `Approval request created successfully. Please review in dashboard: ${context.dashboardUrl || 'Dashboard URL not available'} or VS Code extension 'Spec Workflow MCP'`,
      data: {
        approvalId,
        title: args.title,
        filePath: args.filePath,
        type: args.type,
        status: 'pending',
        dashboardUrl: context.dashboardUrl
      },
      nextSteps: [
        'BLOCKING - Dashboard or VS Code extension approval required',
        'VERBAL APPROVAL NOT ACCEPTED',
        'Do not proceed on verbal confirmation',
        context.dashboardUrl ? `Use dashboard: ${context.dashboardUrl} or VS Code extension 'Spec Workflow MCP'` : 'VS Code extension Spec Workflow MCP',
        `Poll status with: approvals action:"status" approvalId:"${approvalId}"`
      ],
      projectContext: {
        projectPath: validatedProjectPath,
        workflowRoot: join(validatedProjectPath, '.spec-workflow'),
        dashboardUrl: context.dashboardUrl
      }
    };

  } catch (error: any) {
    return {
      success: false,
      message: `Failed to create approval request: ${error.message}`
    };
  }
}

async function handleGetApprovalStatus(
  args: { projectPath?: string; approvalId: string },
  context: ToolContext
): Promise<ToolResponse> {
  // Validate required fields for status action
  if (!args.approvalId) {
    return {
      success: false,
      message: 'Missing required field for status action. Required: approvalId'
    };
  }

  try {
    // Use provided projectPath or fall back to context
    const projectPath = args.projectPath || context.projectPath;
    if (!projectPath) {
      return {
        success: false,
        message: 'Project path is required. Please provide projectPath parameter.'
      };
    }

    // Validate and resolve project path
    const validatedProjectPath = await validateProjectPath(projectPath);

    const approvalStorage = new ApprovalStorage(validatedProjectPath);
    await approvalStorage.start();

    const approval = await approvalStorage.getApproval(args.approvalId);

    if (!approval) {
      await approvalStorage.stop();
      return {
        success: false,
        message: `Approval request not found: ${args.approvalId}`
      };
    }

    await approvalStorage.stop();

    const isCompleted = approval.status === 'approved' || approval.status === 'rejected';
    const canProceed = approval.status === 'approved';
    const mustWait = approval.status !== 'approved';
    const nextSteps: string[] = [];

    if (approval.status === 'pending') {
      nextSteps.push('BLOCKED - Do not proceed');
      nextSteps.push('VERBAL APPROVAL NOT ACCEPTED - Use dashboard or VS Code extension only');
      nextSteps.push('Approval must be done via dashboard or VS Code extension');
      nextSteps.push('Continue polling with approvals action:"status"');
    } else if (approval.status === 'approved') {
      nextSteps.push('APPROVED - Can proceed');
      nextSteps.push('Run approvals action:"delete" before continuing');
      if (approval.response) {
        nextSteps.push(`Response: ${approval.response}`);
      }
    } else if (approval.status === 'rejected') {
      nextSteps.push('BLOCKED - REJECTED');
      nextSteps.push('Do not proceed');
      nextSteps.push('Review feedback and revise');
      if (approval.response) {
        nextSteps.push(`Reason: ${approval.response}`);
      }
      if (approval.annotations) {
        nextSteps.push(`Notes: ${approval.annotations}`);
      }
    } else if (approval.status === 'needs-revision') {
      nextSteps.push('BLOCKED - Do not proceed');
      nextSteps.push('Update document with feedback');
      nextSteps.push('Create NEW approval request');
      if (approval.response) {
        nextSteps.push(`Feedback: ${approval.response}`);
      }
      if (approval.annotations) {
        nextSteps.push(`Notes: ${approval.annotations}`);
      }
      if (approval.comments && approval.comments.length > 0) {
        nextSteps.push(`${approval.comments.length} comments for targeted fixes:`);
        // Add each comment to nextSteps for visibility
        approval.comments.forEach((comment, index) => {
          if (comment.type === 'selection' && comment.selectedText) {
            nextSteps.push(`  Comment ${index + 1} on "${comment.selectedText.substring(0, 50)}...": ${comment.comment}`);
          } else {
            nextSteps.push(`  Comment ${index + 1} (general): ${comment.comment}`);
          }
        });
      }
    }

    return {
      success: true,
      message: approval.status === 'pending'
        ? `BLOCKED: Status is ${approval.status}. Verbal approval is NOT accepted. Use dashboard or VS Code extension only.`
        : `Approval status: ${approval.status}`,
      data: {
        approvalId: args.approvalId,
        title: approval.title,
        type: approval.type,
        status: approval.status,
        createdAt: approval.createdAt,
        respondedAt: approval.respondedAt,
        response: approval.response,
        annotations: approval.annotations,
        comments: approval.comments,
        isCompleted,
        canProceed,
        mustWait,
        blockNext: !canProceed,
        dashboardUrl: context.dashboardUrl
      },
      nextSteps,
      projectContext: {
        projectPath: validatedProjectPath,
        workflowRoot: join(validatedProjectPath, '.spec-workflow'),
        dashboardUrl: context.dashboardUrl
      }
    };

  } catch (error: any) {
    return {
      success: false,
      message: `Failed to check approval status: ${error.message}`
    };
  }
}

async function handleDeleteApproval(
  args: { projectPath?: string; approvalId: string },
  context: ToolContext
): Promise<ToolResponse> {
  // Validate required fields for delete action
  if (!args.approvalId) {
    return {
      success: false,
      message: 'Missing required field for delete action. Required: approvalId'
    };
  }

  try {
    // Use provided projectPath or fall back to context
    const projectPath = args.projectPath || context.projectPath;
    if (!projectPath) {
      return {
        success: false,
        message: 'Project path is required. Please provide projectPath parameter.'
      };
    }

    // Validate and resolve project path
    const validatedProjectPath = await validateProjectPath(projectPath);

    const approvalStorage = new ApprovalStorage(validatedProjectPath);
    await approvalStorage.start();

    // Check if approval exists and its status
    const approval = await approvalStorage.getApproval(args.approvalId);
    if (!approval) {
      return {
        success: false,
        message: `Approval request "${args.approvalId}" not found`,
        nextSteps: [
          'Verify approval ID',
          'Check status with approvals action:"status"'
        ]
      };
    }

    // Only allow deletion of approved requests
    if (approval.status !== 'approved') {
      return {
        success: false,
        message: `BLOCKED: Cannot proceed - status is "${approval.status}". VERBAL APPROVAL NOT ACCEPTED. Use dashboard or VS Code extension.`,
        data: {
          approvalId: args.approvalId,
          currentStatus: approval.status,
          title: approval.title,
          blockProgress: true,
          canProceed: false
        },
        nextSteps: [
          'STOP - Do not proceed to next phase',
          'Wait for approval',
          'Poll with approvals action:"status"'
        ]
      };
    }

    // Delete the approval
    const deleted = await approvalStorage.deleteApproval(args.approvalId);
    await approvalStorage.stop();

    if (deleted) {
      return {
        success: true,
        message: `Approval request "${args.approvalId}" deleted successfully`,
        data: {
          deletedApprovalId: args.approvalId,
          title: approval.title,
          category: approval.category,
          categoryName: approval.categoryName
        },
        nextSteps: [
          'Cleanup complete',
          'Continue to next phase'
        ],
        projectContext: {
          projectPath: validatedProjectPath,
          workflowRoot: join(validatedProjectPath, '.spec-workflow'),
          dashboardUrl: context.dashboardUrl
        }
      };
    } else {
      return {
        success: false,
        message: `Failed to delete approval request "${args.approvalId}"`,
        nextSteps: [
          'Check file permissions',
          'Verify approval exists',
          'Retry'
        ]
      };
    }

  } catch (error: any) {
    return {
      success: false,
      message: `Failed to delete approval: ${error.message}`,
      nextSteps: [
        'Check project path',
        'Verify permissions',
        'Check approval system'
      ]
    };
  }
}