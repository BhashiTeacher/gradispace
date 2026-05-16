# Gradispace

Online exam platform for teachers — create, publish and analyse exams at scale.

## Stack
- **Backend**: Node.js + Express
- **Database**: PostgreSQL (Railway)
- **File storage**: Cloudinary (images, audio)
- **Auth**: JWT + bcrypt
- **Billing**: Stripe subscriptions
- **Email**: Resend
- **Hosting**: Railway

## Structure
```
server/   Node.js + Express API
client/   Frontend (teacher dashboard + student pages)
docs/     API contract and design notes
_legacy/  Previous exam system (reference only, not deployed)
```

## Getting started
```bash
cd server && npm install
cp .env.example .env   # fill in values
npm run dev
```

## Docs
See [docs/api.md](docs/api.md) for the full API contract.
