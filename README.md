# MeD – Dawai Ghar Tak 💊
### Village Medicine Delivery Web App

---

## 📁 File Overview

| File | Purpose |
|---|---|
| `index.html` | Main HTML shell (SPA) |
| `style.css` | Full design system |
| `app.js` | All app logic, routing, views |
| `config.js` | **Your API keys go here** |
| `google-apps-script.js` | Backend code for Google Sheets |

---

## 🚀 Setup (Step by Step)

### Step 1 – Google Sheet Setup

1. Go to [sheets.google.com](https://sheets.google.com) → create a new spreadsheet
2. Name it **MeD-Database**
3. Note the **Sheet ID** from the URL:
   `https://docs.google.com/spreadsheets/d/**THIS-IS-YOUR-ID**/edit`
4. Manually create these 4 sheet tabs (lowercase exactly):
   - `Users`, `Orders`, `Areas`, `Providers`

> The Apps Script will auto-create headers on first use.

---

### Step 2 – Add Areas & Providers to Sheet

In the **Areas** sheet, add rows manually:

| area_id | area_name |
|---|---|
| A001 | Rampur Bazar |
| A002 | Shivnagar Chowk |
| A003 | Laxmi Nagar |

In the **Providers** sheet, add shopkeepers:

| provider_id | name | area_id | mobile | password | role |
|---|---|---|---|---|---|
| P001 | Rajesh Medical Store | A001 | 9876543210 | shop@123 | shopkeeper |
| P002 | Gaon ka Ladka | A001 | 9876543211 | gaon@456 | shopkeeper |

> ⚠️ **Shopkeepers log in using the mobile + password you set here manually.**

---

### Step 3 – Deploy Google Apps Script

1. Go to [script.google.com](https://script.google.com) → New Project
2. Delete any existing code and paste the entire content of `google-apps-script.js`
3. Replace these two lines at the top:
   ```js
   const SPREADSHEET_ID = "YOUR_GOOGLE_SHEET_ID";
   const FAST2SMS_API_KEY = "YOUR_FAST2SMS_API_KEY";
   ```
4. Click **Deploy → New Deployment**
   - Type: **Web App**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Click **Deploy** → Copy the **Web App URL**

---

### Step 4 – Setup Cleanup Trigger (Delete old orders)

1. In the Apps Script editor → **Triggers** (clock icon on left)
2. Add Trigger:
   - Function: `deleteOldOrders`
   - Event source: Time-driven → Day timer → Any time

---

### Step 5 – Fill in config.js

Open `config.js` and fill in your values:

```js
const CONFIG = {
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/YOUR_ID/exec",
  FAST2SMS_API_KEY: "YOUR_KEY",
  IMGBB_API_KEY: "YOUR_KEY",
  ...
};
```

---

### Step 6 – Host on GitHub Pages

1. Create a GitHub repo (e.g., `med-delivery`)
2. Upload all files: `index.html`, `style.css`, `app.js`, `config.js`
3. Go to repo **Settings → Pages → Source → main branch → / (root)**
4. Your app is live at `https://yourusername.github.io/med-delivery/`

> ⚠️ **Do NOT upload `google-apps-script.js` with real credentials to a public repo.**  
> Keep `config.js` private or use GitHub Secrets.

---

## 📱 App Features

| Feature | Status |
|---|---|
| User Registration (SMS password) | ✅ |
| User Login / Logout | ✅ |
| Password Reset via SMS | ✅ |
| Area Selection (from Sheet) | ✅ |
| Provider Selection by Area | ✅ |
| Order Form with Photo Upload | ✅ |
| 7 PM Cutoff Auto-switch | ✅ |
| Order History (last 7 days) | ✅ |
| Shopkeeper Dashboard (full view) | ✅ |
| Orders by Today/Kal/Week | ✅ |
| Auto-delete orders after 30 days | ✅ |
| Mobile-first responsive design | ✅ |

---

## 🔑 API Keys to Get

| Service | Link | Cost |
|---|---|---|
| Fast2SMS | [fast2sms.com](https://fast2sms.com) | Free tier available |
| ImgBB | [imgbb.com/api](https://api.imgbb.com/) | Free |
| Google Sheets + Apps Script | Already free | Free |

---

## 🛠️ Troubleshooting

**CORS error on POST?**  
→ Make sure Apps Script is deployed with access: **Anyone** (not just logged-in users)

**SMS not received?**  
→ Check Fast2SMS key in `google-apps-script.js` (not in `config.js` — SMS is sent from the server side)

**Orders not loading?**  
→ Check APPS_SCRIPT_URL in `config.js`. Open it directly in browser — you should get a JSON response.

**Photo not uploading?**  
→ Check IMGBB_API_KEY in `config.js`.
