const ssoAuthenticationFlow: 'code' | 'password' = 'code'
// let serviceEndpoint = "http://172.17.10.60:2100";
// let userManagementEndpoint = "http://172.17.10.13:2000";
// let identityEndpoint = "http://sso.epciran.ir";
// let fileManagementEndpoint = "http://172.17.10.16:2000";
// let selfEndpoint = "http://meeting.epciran.ir";


let serviceEndpoint = "https://localhost:8001";
let userManagementEndpoint = "https://localhost:6001";
let identityEndpoint = "https://localhost:7001";
let fileManagementEndpoint = "https://localhost:4001";
let selfEndpoint = "http://localhost:4200";
let systemGuid = 'd4498b9d-fe54-4c65-b1d3-35022dab7dbb';
let boardCategoryGuid = 'fa370076-d2a9-4546-b00c-71de1a370306';
let defaultFollowerGuid = '78bb455B-F24b-42cf-86b6-f616076ca722';
let defaultFollowerPositionGuid = 'f1f5b492-34a1-4e18-bdcf-9d7948094207';
let committeeGuid = 'ea232fb3-08ae-402b-9fd6-f7758965e410'

export function getServiceUrl() {
    return `${serviceEndpoint}/api/`;
}
export function getFileManagementUrl() {
    return `${fileManagementEndpoint}/api/`;
}
export function getUserManagementUrl() {
    return `${userManagementEndpoint}/api/`;
}

export function getIdentityUrl() {
    return `${identityEndpoint}/api/`;
}

export function getLoginUrl() {
    return `${identityEndpoint}/connect/token`;
}

export const environment = {
    appVersion: '1.0.0',
    production: false,
    identityEndpoint,
    selfEndpoint,
    systemGuid,
    ssoAuthenticationFlow,
    fileManagementEndpoint,
    boardCategoryGuid,
    defaultFollowerGuid,
    defaultFollowerPositionGuid,
    committeeGuid,
    getServiceUrl,
    getFileManagementUrl,
    getUserManagementUrl,
    getIdentityUrl,
    getLoginUrl
};
