# Zap Shift Server

Zap Shift Server is the backend API for the Zap Shift parcel delivery project. It uses Express, MongoDB, Firebase Admin authentication, and Stripe payments to manage users, parcels, riders, parcel status updates, and payment records.

## Features

- Firebase ID token verification for protected routes
- MongoDB collections for users, parcels, riders, and payments
- Parcel creation, listing, lookup, deletion, and status updates
- Rider application and rider assignment workflow
- Stripe payment intent creation
- Payment history lookup for authenticated users
- Parcel status history tracking 

## Tech Stack

- Node.js
- Express
- MongoDB
- Firebase Admin SDK
- Stripe


## Environment Variables

Create a `.env` file in the project root using `.env.example` as a guide.

```env
DB_USERNAME=your_mongodb_username
DB_PASSWORD=your_mongodb_password
SECRET_KEY=your_stripe_secret_key
PORT=5000
```

The server also expects a Firebase service account file named:

```text
firebase-private-key.json
```

Keep `.env` and `firebase-private-key.json` private. They should not be committed to a public repository.

## Installation

```bash
npm install
```

## Running Locally

Run the server with Node:

```bash
node index.js
```

Or run it with nodemon:

```bash
npx nodemon index.js
```

By default, the API runs on:

```text
http://localhost:5000
```

## API Overview

### Parcels

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/parcel` | Get one parcel by `id` or `parcelId` |
| GET | `/parcels` | Get parcels by user email, search text, rider email, or status |
| POST | `/parcels` | Create a new parcel |
| PATCH | `/parcel/:id` | Update parcel status |
| DELETE | `/parcel` | Delete a parcel by query `id` |
| GET | `/admin/parcels` | Get admin parcel list by payment and parcel status |
| PATCH | `/assign-rider` | Assign a rider to a parcel |

### Payments

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/create-payment-intent` | Create a Stripe payment intent |
| GET | `/payments` | Get payment history for an authenticated user |
| POST | `/payments` | Save a payment record and mark a parcel as paid |

### Users

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/user` | Get a user by `uid` or `email` |
| GET | `/users&admin` | Get users with `user` or `admin` roles |
| POST | `/users` | Create a user if one does not already exist |
| PATCH | `/user/:id` | Update a user |
| GET | `/role/:email` | Get a user's role |

### Riders

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/riders` | Get riders with optional search, district, status, skip, and limit filters |
| GET | `/pending-riders` | Get pending rider applications |
| GET | `/rider-application/check` | Check rider application by email |
| POST | `/riders-request` | Submit a rider application |
| PATCH | `/pending-riders` | Update rider application status |

## Authentication

Protected routes expect a Firebase ID token in the `Authorization` header:

```http
Authorization: Bearer <firebase_id_token>
```

Some admin routes also check whether the authenticated user's role is `admin` in the `users` collection.

## Database Collections

The server uses the `zap_shift-user_db` MongoDB database with these collections:

- `parcels`
- `payments`
- `users`
- `riders`

