# Security Policy

## Scope

Housekeeping for ArcGIS is a client-only web application. It makes authenticated calls to ArcGIS Online on behalf of the signed-in user. It has no backend, no database, and stores no data outside the browser session.

Most security-relevant behaviour (authentication, authorisation, token management) is handled by ArcGIS Online and the `@esri/arcgis-rest-request` library. Reports about ArcGIS Online itself should go to [Esri's responsible disclosure programme](https://www.esri.com/en-us/legal/terms/product-specific-scope-of-use/additional-esri-online-services-terms-of-use).

## Reporting a vulnerability

If you believe you have found a security vulnerability in this application, please report it by email to **simon.robin.jackson@gmail.com** with the subject line `[housekeeping-for-arcgis] Security report`.

Please include:
- A description of the issue and its potential impact
- Steps to reproduce
- Any relevant browser, OS, and version information

Response is best-effort for a personal project — not SLA-bound. I aim to acknowledge reports within a week and patch confirmed vulnerabilities promptly.

Please do not open a public GitHub issue for security vulnerabilities.
