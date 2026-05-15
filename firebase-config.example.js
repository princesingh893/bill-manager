// Copy this file to firebase-config.js and fill in your Firebase project details.
// Firebase Console: https://console.firebase.google.com/
// 1. Create project → Build → Realtime Database → Create database (any region)
// 2. Rules tab → paste rules below → Publish
// 3. Project settings → Your apps → Web app → copy config

window.FIREBASE_ENABLED = true;

window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyBveOQ_y8EoaP_GpdZ06DRUyRCEUArLsNo",
  authDomain: "bill-80cdc.firebaseapp.com",
  databaseURL: "https://bill-80cdc-default-rtdb.firebaseio.com",
  projectId: "bill-80cdc",
  storageBucket: "bill-80cdc.firebasestorage.app",
  messagingSenderId: "94116797226",
  appId: "1:94116797226:web:dc1b4c0b151a7bba415c53"
};

// Realtime Database → Rules (for personal use):
// {
//   "rules": {
//     "billManager": {
//       "$syncId": {
//         ".read": true,
//         ".write": true
//       }
//     }
//   }
// }
