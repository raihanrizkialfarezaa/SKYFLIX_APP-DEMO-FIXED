# Panduan Testing API Skyflix dengan Postman

## Daftar Isi
- [Setup Awal](#setup-awal)
- [Autentikasi](#autentikasi)
- [Testing API Film](#testing-api-film)
- [Testing API Subscription](#testing-api-subscription)
- [Testing API Watchlist](#testing-api-watchlist)
- [Testing API Content Access](#testing-api-content-access)
- [Testing API Notification](#testing-api-notification)
- [Testing API Search](#testing-api-search)
- [Testing API Payment](#testing-api-payment)
- [Testing API Analytics](#testing-api-analytics)
- [Testing API Report](#testing-api-report)

## Setup Awal
1. Buat Environment di Postman
   - Klik "Environments" > "Create Environment"
   - Buat environment dengan nama "Skyflix API"
   - Tambahkan variable berikut:
     ```
     BASE_URL: http://localhost:5000/api
     TOKEN: [kosongkan dulu]
     ```

2. Import Collection
   - Buat collection baru dengan nama "Skyflix API"
   - Atur Authorization type ke "Bearer Token"
   - Di Token field, masukkan `{{TOKEN}}`

## Autentikasi

### Register User
```http
POST {{BASE_URL}}/auth/register
Content-Type: application/json

{
    "username": "testuser",
    "email": "test@example.com",
    "password": "Password123!",
    "fullName": "Test User",
    "dateOfBirth": "1990-01-01",
    "country": "Indonesia"
}
```

Expected Response:
```json
{
    "message": "User registered successfully",
    "token": "eyJhbG...",
    "user": {
        "_id": "65c8f...",
        "username": "testuser",
        "email": "test@example.com",
        "fullName": "Test User",
        "country": "Indonesia",
        "accountType": "free"
    }
}
```

### Login User
```http
POST {{BASE_URL}}/auth/login
Content-Type: application/json

{
    "username": "testuser",
    "password": "Password123!"
}
```

Expected Response:
```json
{
    "message": "Login successful",
    "token": "eyJhbG...",
    "user": {
        "_id": "65c8f...",
        "username": "testuser",
        "email": "test@example.com",
        "fullName": "Test User",
        "subscription": null,
        "accountType": "free"
    }
}
```

Setelah login berhasil:
1. Salin token dari response
2. Atur environment variable TOKEN dengan token tersebut

## Testing API Film

### Get All Films
```http
GET {{BASE_URL}}/films?page=1&limit=10
```

Query Parameters:
- page: nomor halaman (default: 1)
- limit: jumlah item per halaman (default: 10)
- genre: filter berdasarkan genre (opsional)
- search: filter berdasarkan judul (opsional)

### Get Film by Title
```http
GET {{BASE_URL}}/films/title/The%20Matrix
```

### Upload Film (Admin Only)
```http
POST {{BASE_URL}}/films/upload
Content-Type: multipart/form-data

video: [pilih file]
title: "Sample Movie"
description: "A great movie"
releaseYear: "2024"
duration: "7200"
ageRating: "PG-13"
studioId: "65c8f..."
directors: [{"directorId":"65c8f...","directorName":"John Doe"}]
genres: [{"genreId":"65c8f...","genreName":"Action"}]
cast: [{"actorId":"65c8f...","characterName":"Neo","role":"lead","screenTime":120}]
```

### Update View Count
```http
POST {{BASE_URL}}/films/view/The%20Matrix
Content-Type: application/json

{
    "watchDuration": 3600,
    "quality": "HD",
    "device": "desktop"
}
```

## Testing API Subscription

### Check Status
```http
GET {{BASE_URL}}/subscription/status
```

### Start Subscription
```http
POST {{BASE_URL}}/subscription/start
Content-Type: application/json

{
    "planType": "monthly",
    "paymentMethod": "credit_card"
}
```

### Cancel Subscription
```http
POST {{BASE_URL}}/subscription/cancel
```

## Testing API Watchlist

### Get Watchlist
```http
GET {{BASE_URL}}/watchlist
```

### Add to Watchlist
```http
POST {{BASE_URL}}/watchlist/add
Content-Type: application/json

{
    "title": "The Matrix",
    "priority": 1,
    "notes": "Must watch this weekend"
}
```

### Remove from Watchlist
```http
DELETE {{BASE_URL}}/watchlist/65c8f...
```

## Testing API Content Access

### Check Access
```http
GET {{BASE_URL}}/content-access/check/The%20Matrix
```

### Get Viewing History
```http
GET {{BASE_URL}}/content-access/history?page=1&limit=10
```

### Create Content Access (Admin)
```http
POST {{BASE_URL}}/content-access/create
Content-Type: application/json

{
    "filmId": "65c8f...",
    "contentType": "premium"
}
```

## Testing API Notification

### Get User Notifications
```http
GET {{BASE_URL}}/notifications?page=1&limit=10&unreadOnly=false
```

### Mark as Read
```http
PUT {{BASE_URL}}/notifications/65c8f.../read
```

### Mark All as Read
```http
PUT {{BASE_URL}}/notifications/read-all
```

### Update Preferences
```http
PUT {{BASE_URL}}/notifications/preferences
Content-Type: application/json

{
    "watchlistReminders": true,
    "subscriptionAlerts": true,
    "newContentAlerts": true
}
```

## Testing API Search

### Search Content
```http
GET {{BASE_URL}}/search?query=action&page=1&limit=10
```

Query Parameters:
- query: kata kunci pencarian
- filters: filter tambahan (JSON string)
- sort: pengurutan (JSON string)
- page: nomor halaman
- limit: jumlah item per halaman

Example with Filters:
```http
GET {{BASE_URL}}/search?query=action&filters={"genres":["Action"],"releaseYear":2024}&sort={"viewCount":-1}
```

### Get Search Filters
```http
GET {{BASE_URL}}/search/filters
```

### Get Search Suggestions
```http
GET {{BASE_URL}}/search/suggestions?query=mat
```

## Testing API Payment

### Process Payment
```http
POST {{BASE_URL}}/payments/process
Content-Type: application/json

{
    "paymentMethod": "credit_card",
    "planType": "monthly",
    "cardInfo": {
        "cardType": "visa",
        "cardNumber": "4111111111111111",
        "expirationDate": "2025-12"
    }
}
```

### Upload Payment Proof
```http
POST {{BASE_URL}}/payments/65c8f.../proof
Content-Type: multipart/form-data

paymentProof: [pilih file]
notes: "Bank transfer receipt"
```

### Get Payment History
```http
GET {{BASE_URL}}/payments/history?page=1&limit=10
```

## Testing API Analytics (Admin Only)

### Get User Engagement
```http
GET {{BASE_URL}}/analytics/user-engagement?startDate=2024-01-01&endDate=2024-12-31
```

### Get Content Performance
```http
GET {{BASE_URL}}/analytics/content-performance?period=30days
```

### Get Subscription Metrics
```http
GET {{BASE_URL}}/analytics/subscription-metrics?period=monthly
```

## Testing API Report (Admin Only)

### Get User Engagement Report
```http
GET {{BASE_URL}}/reporting/user-engagement?startDate=2024-01-01&endDate=2024-12-31
```

### Get Content Performance Report
```http
GET {{BASE_URL}}/reporting/content-performance?period=month
```

### Get Revenue Report
```http
GET {{BASE_URL}}/reporting/revenue?period=monthly
```

### Get System Health Report
```http
GET {{BASE_URL}}/reporting/system-health
```

## Tips Testing
1. Selalu cek response status code:
   - 200: Sukses
   - 201: Created
   - 400: Bad Request
   - 401: Unauthorized
   - 403: Forbidden
   - 404: Not Found
   - 500: Server Error

2. Validasi response body sesuai dengan format yang diharapkan

3. Test case negatif:
   - Input invalid
   - Token invalid/expired
   - Permission tidak cukup
   - Resource tidak ditemukan

4. Test pagination:
   - First page
   - Middle page
   - Last page
   - Invalid page number

5. Test sorting dan filtering:
   - Ascending/descending
   - Multiple filters
   - Invalid filter values

6. Rate limiting:
   - Test batas request per menit
   - Verifikasi response ketika limit terlampaui

7. File upload:
   - Valid file types
   - Invalid file types
   - File size limits
   - Corrupt files

## Activity & Streaming API Testing

### Start Streaming Session
```http
POST {{BASE_URL}}/activity/streaming/start
Content-Type: application/json

{
    "filmId": "65c8f...",
    "quality": "HD",
    "device": "mobile",
    "network": "wifi"
}
```

Expected Response:
```json
{
    "success": true,
    "message": "Streaming session started successfully",
    "data": {
        "sessionId": "65c8f...",
        "userId": "65c8f...",
        "filmId": "65c8f...",
        "title": "Movie Title",
        "startTime": "2024-02-11T08:00:00.000Z",
        "contentType": "premium",
        "streaming": {
            "quality": "HD",
            "device": "mobile",
            "network": "wifi"
        }
    }
}
```

### End Streaming Session
```http
PUT {{BASE_URL}}/activity/streaming/{{sessionId}}/end
```

Expected Response:
```json
{
    "message": "Streaming session ended"
}
```

### Log Buffering Event
```http
POST {{BASE_URL}}/activity/streaming/{{sessionId}}/buffering
Content-Type: application/json

{
    "duration": 5,
    "reason": "network_congestion"
}
```

### Log Quality Change
```http
POST {{BASE_URL}}/activity/streaming/{{sessionId}}/quality
Content-Type: application/json

{
    "quality": "4K"
}
```

### Get Viewing Stats
```http
GET {{BASE_URL}}/activity/stats/viewing
```

Expected Response:
```json
{
    "totalWatchTime": 360,
    "averageSessionDuration": 45,
    "totalSessions": 8,
    "bufferingEvents": 3,
    "qualityChanges": 2
}
```

### Get System Metrics (Admin Only)
```http
GET {{BASE_URL}}/activity/stats/system?startDate=2024-01-01&endDate=2024-02-11
```

## Recommendation API Testing

### Get Personalized Recommendations
```http
GET {{BASE_URL}}/recommendations/personalized
```

Expected Response:
```json
{
    "success": true,
    "recommendations": [
        {
            "_id": "65c8f...",
            "title": "Movie Title",
            "description": "Movie Description",
            "matchScore": 0.85,
            "genres": ["Action", "Sci-Fi"]
        }
    ]
}
```

### Get Trending Content
```http
GET {{BASE_URL}}/recommendations/trending
```

### Get Similar Content
```http
GET {{BASE_URL}}/recommendations/similar/{{filmId}}
```

### Get Genre-based Recommendations
```http
GET {{BASE_URL}}/recommendations/genre/{{genreId}}?limit=10
```

### Refresh Trending Cache (Admin Only)
```http
POST {{BASE_URL}}/recommendations/trending/refresh
Authorization: Bearer {{TOKEN}}
```

## Extended User API Testing

### Change Password
```http
PUT {{BASE_URL}}/users/change-password
Content-Type: application/json

{
    "currentPassword": "oldpass123",
    "newPassword": "newpass123"
}
```

Expected Response:
```json
{
    "message": "Password updated successfully"
}
```

### Delete Profile
```http
DELETE {{BASE_URL}}/users/profile
Content-Type: application/json

{
    "password": "yourpassword"
}
```

Expected Response:
```json
{
    "message": "Profile and all associated data deleted successfully"
}
```

### Update Payment Info
```http
PUT {{BASE_URL}}/users/payment-info
Content-Type: application/json

{
    "cardType": "visa",
    "cardNumber": "4111111111111111",
    "expirationDate": "2025-12"
}
```

## Admin API Testing

### Verify Subscription Payment
```http
POST {{BASE_URL}}/admin/verify-subscription
Content-Type: application/json

{
    "userId": "65c8f...",
    "status": "active",
    "adminNotes": "Payment verified via bank transfer"
}
```

Expected Response:
```json
{
    "message": "Subscription active",
    "userId": "65c8f...",
    "status": "active",
    "accountType": "premium"
}
```

### Get Pending Verifications
```http
GET {{BASE_URL}}/admin/pending-verifications?page=1&limit=10
```

### Get Subscription Analytics
```http
GET {{BASE_URL}}/admin/subscription-analytics?startDate=2024-01-01&endDate=2024-02-11
```

## Testing Tips untuk Endpoint Baru

### Activity Testing
1. Test skenario streaming yang berbeda:
   - Berbagai kualitas video
   - Berbagai jenis device
   - Berbagai jenis network
2. Validasi buffering events:
   - Durasi berbeda
   - Berbagai alasan buffering
3. Test concurrent streaming sessions

### Recommendation Testing
1. Test rekomendasi dengan:
   - User baru tanpa history
   - User dengan history tontonan beragam
   - User dengan preferensi spesifik
2. Validasi similar content dengan:
   - Film dari genre sama
   - Film dari genre berbeda
   - Film dengan rating sama

### Admin Testing
1. Test verifikasi subscription:
   - Approval case
   - Rejection case
   - Invalid user ID
2. Test analytics dengan:
   - Different date ranges
   - Different metrics
   - Edge cases

### Error Cases yang Perlu Ditest
1. Activity API:
   - Invalid session ID
   - Expired session
   - Invalid quality values
   - Missing required fields

2. Recommendation API:
   - Invalid film ID
   - Invalid genre ID
   - Non-existent content

3. Admin API:
   - Invalid user ID
   - Invalid status values
   - Missing permissions

## Automation Scripts untuk Postman

### Activity Test Script
```javascript
pm.test("Streaming session started successfully", function () {
    pm.response.to.have.status(200);
    const response = pm.response.json();
    pm.expect(response.success).to.be.true;
    pm.expect(response.data.sessionId).to.exist;
    
    // Save sessionId for subsequent requests
    pm.environment.set("sessionId", response.data.sessionId);
});
```

### Recommendation Test Script
```javascript
pm.test("Recommendations are valid", function () {
    pm.response.to.have.status(200);
    const response = pm.response.json();
    pm.expect(response.recommendations).to.be.an('array');
    pm.expect(response.recommendations.length).to.be.at.least(1);
});
```

### Admin Test Script
```javascript
pm.test("Subscription verification successful", function () {
    pm.response.to.have.status(200);
    const response = pm.response.json();
    pm.expect(response.status).to.be.oneOf(['active', 'rejected']);
    pm.expect(response.accountType).to.exist;
});
```

## Environment Variables Tambahan
```json
{
    "sessionId": "",
    "lastFilmId": "",
    "lastGenreId": ""
}
```

## Collection Variables Tambahan
```json
{
    "validQualities": ["SD", "HD", "4K"],
    "validDevices": ["mobile", "tablet", "desktop", "smart_tv"],
    "validNetworks": ["wifi", "4g", "5g", "ethernet"]
}
```
