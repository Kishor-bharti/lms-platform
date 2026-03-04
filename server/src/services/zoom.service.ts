import logger from '../config/logger';

export interface ZoomMeetingResult {
  joinUrl: string | undefined;
  startUrl: string | undefined;
}

export async function getZoomAccessToken(): Promise<string> {
  const ZOOM_ACCOUNT_ID = process.env.ZOOM_ACCOUNT_ID;
  const ZOOM_CLIENT_ID = process.env.ZOOM_CLIENT_ID;
  const ZOOM_CLIENT_SECRET = process.env.ZOOM_CLIENT_SECRET;

  if (!ZOOM_ACCOUNT_ID || !ZOOM_CLIENT_ID || !ZOOM_CLIENT_SECRET) {
    throw new Error('Missing Zoom credentials');
  }

  try {
    const tokenRes = await (globalThis as any).fetch(
      `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(ZOOM_ACCOUNT_ID)}`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + Buffer.from(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`).toString('base64')
        }
      }
    );

    if (!tokenRes.ok) {
      const txt = await tokenRes.text();
      logger.error('Zoom token fetch failed', { status: tokenRes.status, message: txt });
      throw new Error('Failed to obtain Zoom access token');
    }

    const tokenJson = await tokenRes.json();
    return tokenJson.access_token as string;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Zoom token error: ${msg}`);
  }
}

export async function createZoomMeeting(params: {
  accessToken: string;
  hostEmail: string;
  topic: string;
  startTime: string;
}): Promise<ZoomMeetingResult> {
  const meetingBody = {
    topic: params.topic,
    type: 2,
    start_time: params.startTime,
    duration: 60,
    settings: {
      host_video: true,
      participant_video: true,
      join_before_host: false,
      waiting_room: true,
      auto_recording: 'none',
    }
  };

  try {
    const createRes = await (globalThis as any).fetch(
      `https://api.zoom.us/v2/users/${encodeURIComponent(params.hostEmail)}/meetings`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(meetingBody)
      }
    );

    if (!createRes.ok) {
      const txt = await createRes.text();
      logger.error('Zoom meeting creation failed', { status: createRes.status, message: txt });
      throw new Error('Failed to create Zoom meeting');
    }

    const meetingJson = await createRes.json();
    return { joinUrl: meetingJson.join_url, startUrl: meetingJson.start_url };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Zoom meeting error: ${msg}`);
  }
}

export async function zoomHealthCheck(): Promise<{ ok: boolean; status?: number; message?: string }> {
  const ZOOM_ACCOUNT_ID = process.env.ZOOM_ACCOUNT_ID;
  const ZOOM_CLIENT_ID = process.env.ZOOM_CLIENT_ID;
  const ZOOM_CLIENT_SECRET = process.env.ZOOM_CLIENT_SECRET;

  if (!ZOOM_ACCOUNT_ID || !ZOOM_CLIENT_ID || !ZOOM_CLIENT_SECRET) {
    return { ok: false, message: 'Missing Zoom env vars' };
  }

  try {
    const tokenRes = await (globalThis as any).fetch(
      `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(ZOOM_ACCOUNT_ID)}`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + Buffer.from(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`).toString('base64')
        }
      }
    );

    if (!tokenRes.ok) {
      const txt = await tokenRes.text();
      return { ok: false, status: tokenRes.status, message: txt };
    }

    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, message: msg };
  }
}
