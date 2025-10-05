import React, { createContext, useContext, useMemo, useState, useCallback, useEffect } from 'react';
import { useWs } from '../ws/WebSocketProvider';

export type SpecSummary = {
  name: string;
  displayName: string;
  status?: string;
  lastModified?: string;
  taskProgress?: { total: number; completed: number };
  phases?: any;
};

export type Approval = {
  id: string;
  title: string;
  status: string;
  type?: string;
  filePath?: string;
  content?: string;
  createdAt?: string;
};

export type ProjectInfo = {
  projectName: string;
  steering?: any;
  version?: string;
};

export interface DocumentSnapshot {
  id: string;
  approvalId: string;
  approvalTitle: string;
  version: number;
  timestamp: string;
  trigger: 'initial' | 'revision_requested' | 'approved' | 'manual';
  status: 'pending' | 'approved' | 'rejected' | 'needs-revision';
  content: string;
  fileStats: {
    size: number;
    lines: number;
    lastModified: string;
  };
  comments?: any[];
  annotations?: string;
}

export interface DiffResult {
  additions: number;
  deletions: number;
  changes: number;
  chunks: DiffChunk[];
}

export interface DiffChunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface DiffLine {
  type: 'add' | 'delete' | 'normal';
  oldLineNumber?: number;
  newLineNumber?: number;
  content: string;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`);
  return res.json();
}

async function postJson(url: string, body: any) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { ok: res.ok, status: res.status };
}

async function putJson(url: string, body: any) {
  const res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { ok: res.ok, status: res.status, data: res.ok ? await res.json() : null };
}

type ApiContextType = {
  specs: SpecSummary[];
  archivedSpecs: SpecSummary[];
  approvals: Approval[];
  info?: ProjectInfo;
  steeringDocuments?: any;
  reloadAll: () => Promise<void>;
  getAllSpecDocuments: (name: string) => Promise<Record<string, { content: string; lastModified: string } | null>>;
  getAllArchivedSpecDocuments: (name: string) => Promise<Record<string, { content: string; lastModified: string } | null>>;
  getSpecTasksProgress: (name: string) => Promise<any>;
  updateTaskStatus: (specName: string, taskId: string, status: 'pending' | 'in-progress' | 'completed') => Promise<{ ok: boolean; status: number; data?: any }>;
  approvalsAction: (id: string, action: 'approve' | 'reject' | 'needs-revision', payload: any) => Promise<{ ok: boolean; status: number }>;
  getApprovalContent: (id: string) => Promise<{ content: string; filePath?: string }>;
  getApprovalSnapshots: (id: string) => Promise<DocumentSnapshot[]>;
  getApprovalSnapshot: (id: string, version: number) => Promise<DocumentSnapshot>;
  getApprovalDiff: (id: string, fromVersion: number, toVersion?: number | 'current') => Promise<DiffResult>;
  captureApprovalSnapshot: (id: string) => Promise<{ success: boolean; message: string }>;
  saveSpecDocument: (name: string, document: string, content: string) => Promise<{ ok: boolean; status: number }>;
  saveArchivedSpecDocument: (name: string, document: string, content: string) => Promise<{ ok: boolean; status: number }>;
  archiveSpec: (name: string) => Promise<{ ok: boolean; status: number }>;
  unarchiveSpec: (name: string) => Promise<{ ok: boolean; status: number }>;
  getSteeringDocument: (name: string) => Promise<{ content: string; lastModified: string }>;
  saveSteeringDocument: (name: string, content: string) => Promise<{ ok: boolean; status: number }>;
};

const ApiContext = createContext<ApiContextType | undefined>(undefined);

export function ApiProvider({ initial, children }: { initial?: { specs?: SpecSummary[]; archivedSpecs?: SpecSummary[]; approvals?: Approval[] }; children: React.ReactNode }) {
  const { subscribe, unsubscribe } = useWs();
  const [specs, setSpecs] = useState<SpecSummary[]>(initial?.specs || []);
  const [archivedSpecs, setArchivedSpecs] = useState<SpecSummary[]>(initial?.archivedSpecs || []);
  const [approvals, setApprovals] = useState<Approval[]>(initial?.approvals || []);
  const [info, setInfo] = useState<ProjectInfo | undefined>(undefined);
  const [steeringDocuments, setSteeringDocuments] = useState<any>(undefined);

  const reloadAll = useCallback(async () => {
    const [s, as, a, i] = await Promise.all([
      getJson<SpecSummary[]>('/api/specs'),
      getJson<SpecSummary[]>('/api/specs/archived'),
      getJson<Approval[]>('/api/approvals'),
      getJson<ProjectInfo>('/api/info').catch(() => ({ projectName: 'Project' } as ProjectInfo)),
    ]);
    setSpecs(s);
    setArchivedSpecs(as);
    setApprovals(a);
    setInfo(i);
    setSteeringDocuments(i.steering);
  }, []);

  // Load initial data including info on mount
  useEffect(() => {
    reloadAll();
  }, [reloadAll]);

  // Update state when initial websocket data arrives
  useEffect(() => {
    if (initial?.specs) setSpecs(initial.specs);
    if (initial?.archivedSpecs) setArchivedSpecs(initial.archivedSpecs);
    if (initial?.approvals) setApprovals(initial.approvals);
  }, [initial]);

  // Handle websocket updates for real-time data changes
  useEffect(() => {
    const handleSpecUpdate = (data: { specs?: SpecSummary[]; archivedSpecs?: SpecSummary[] }) => {
      if (data.specs) setSpecs(data.specs);
      if (data.archivedSpecs) setArchivedSpecs(data.archivedSpecs);
    };

    const handleApprovalUpdate = (data: Approval[]) => {
      setApprovals(data);
    };

    const handleSteeringUpdate = (data: any) => {
      setSteeringDocuments(data);
    };

    // Subscribe to websocket events that contain actual data
    // Only handle events that provide the updated data directly
    subscribe('spec-update', handleSpecUpdate);
    subscribe('approval-update', handleApprovalUpdate);
    subscribe('steering-update', handleSteeringUpdate);
    
    // Do NOT handle 'update' and 'task-update' events as they are just file change notifications
    // without updated data - let individual components handle their own updates via specific events

    return () => {
      unsubscribe('spec-update', handleSpecUpdate);
      unsubscribe('approval-update', handleApprovalUpdate);
      unsubscribe('steering-update', handleSteeringUpdate);
    };
  }, [subscribe, unsubscribe, reloadAll]);

  const value = useMemo<ApiContextType>(() => ({
    specs,
    archivedSpecs,
    approvals,
    info,
    steeringDocuments,
    reloadAll,
    getAllSpecDocuments: (name: string) => getJson(`/api/specs/${encodeURIComponent(name)}/all`),
    getAllArchivedSpecDocuments: (name: string) => getJson(`/api/specs/${encodeURIComponent(name)}/all/archived`),
    getSpecTasksProgress: (name: string) => getJson(`/api/specs/${encodeURIComponent(name)}/tasks/progress`),
    updateTaskStatus: (specName: string, taskId: string, status: 'pending' | 'in-progress' | 'completed') => putJson(`/api/specs/${encodeURIComponent(specName)}/tasks/${encodeURIComponent(taskId)}/status`, { status }),
    approvalsAction: (id, action, body) => postJson(`/api/approvals/${encodeURIComponent(id)}/${action}`, body),
    getApprovalContent: (id: string) => getJson(`/api/approvals/${encodeURIComponent(id)}/content`),
    getApprovalSnapshots: (id: string) => getJson(`/api/approvals/${encodeURIComponent(id)}/snapshots`),
    getApprovalSnapshot: (id: string, version: number) => getJson(`/api/approvals/${encodeURIComponent(id)}/snapshots/${version}`),
    getApprovalDiff: (id: string, fromVersion: number, toVersion?: number | 'current') => {
      const to = toVersion === undefined ? 'current' : toVersion;
      return getJson(`/api/approvals/${encodeURIComponent(id)}/diff?from=${fromVersion}&to=${to}`);
    },
    captureApprovalSnapshot: (id: string) => postJson(`/api/approvals/${encodeURIComponent(id)}/snapshot`, {}),
    saveSpecDocument: (name: string, document: string, content: string) => putJson(`/api/specs/${encodeURIComponent(name)}/${encodeURIComponent(document)}`, { content }),
    saveArchivedSpecDocument: (name: string, document: string, content: string) => putJson(`/api/specs/${encodeURIComponent(name)}/${encodeURIComponent(document)}/archived`, { content }),
    archiveSpec: (name: string) => postJson(`/api/specs/${encodeURIComponent(name)}/archive`, {}),
    unarchiveSpec: (name: string) => postJson(`/api/specs/${encodeURIComponent(name)}/unarchive`, {}),
    getSteeringDocument: (name: string) => getJson(`/api/steering/${encodeURIComponent(name)}`),
    saveSteeringDocument: (name: string, content: string) => putJson(`/api/steering/${encodeURIComponent(name)}`, { content }),
  }), [specs, archivedSpecs, approvals, info, steeringDocuments, reloadAll]);

  return <ApiContext.Provider value={value}>{children}</ApiContext.Provider>;
}

export function useApi(): ApiContextType {
  const ctx = useContext(ApiContext);
  if (!ctx) throw new Error('useApi must be used within ApiProvider');
  return ctx;
}


