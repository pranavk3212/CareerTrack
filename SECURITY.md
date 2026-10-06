# Security Policy

## Supported Versions

The latest version on the main branch is the supported version.

## Reporting a Vulnerability

Please do not report security vulnerabilities through public GitHub issues.

Instead, contact the repository owner privately through the contact information on the author's GitHub profile. Include a clear description of the issue, steps to reproduce it, and any relevant impact.

## Security Practices

- Secrets are supplied through environment variables and are not committed to the repository.
- Production database credentials and JWT secrets are stored in Vercel environment variables.
- Authentication uses JWTs and bcrypt password hashing.
