export type PublishResult =
  | { ok: true; webUrl: string }
  | { ok: false; error: 'graph_consent_required' | 'graph_login_required' | 'not_authenticated' | 'other'; message: string };

export interface GraphLoginInfo {
  userCode: string;
  verificationUri: string;
  message: string;
}

export type GraphLoginPoll =
  | { status: 'pending' }
  | { status: 'authenticated' }
  | { status: 'expired' }
  | { status: 'error'; error: string };

export interface SharepointService {
  publish(args: { html: string; filename: string; folderName: string }): Promise<PublishResult>;
  loginStart(): Promise<GraphLoginInfo>;
  loginPoll(): Promise<GraphLoginPoll>;
}
