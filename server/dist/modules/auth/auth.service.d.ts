export declare function login(email: string, password: string): Promise<{
    token: string;
    user: {
        id: number;
        name: string;
        role: import("./auth.types").Role;
    };
}>;
//# sourceMappingURL=auth.service.d.ts.map