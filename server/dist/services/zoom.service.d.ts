export interface ZoomMeetingResult {
    joinUrl: string | undefined;
    startUrl: string | undefined;
}
export declare function getZoomAccessToken(): Promise<string>;
export declare function createZoomMeeting(params: {
    accessToken: string;
    hostEmail: string;
    topic: string;
    startTime: string;
}): Promise<ZoomMeetingResult>;
export declare function zoomHealthCheck(): Promise<{
    ok: boolean;
    status?: number;
    message?: string;
}>;
//# sourceMappingURL=zoom.service.d.ts.map