const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const app = express();

const configuredOrigins = [
  process.env.FRONTEND_URL,
  process.env.CORS_ORIGIN,
  process.env.CLIENT_ORIGIN
]
  .filter(Boolean)
  .flatMap((value) =>
    value.split(",").map((origin) => origin.trim())
  );

const allowedOrigins = new Set([
  "http://localhost:5173",
  "[http://127.0.0.1:5173](http://127.0.0.1:5173)",
  "[http://172.20.10.2:5173](http://172.20.10.2:5173)",
  "[https://evs-inspection-system-dem.vercel.app](https://evs-inspection-system-dem.vercel.app)",
  ...configuredOrigins
]);

function isAllowedOrigin(origin) {
  // السماح بالطلبات التي لا تحتوي على origin (مثل تطبيقات الموبايل أو curl)
  if (!origin) return true;
  return allowedOrigins.has(origin);
}

app.use(helmet({ crossOriginResourcePolicy: false }));

app.use(cors({
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }

    console.log("Blocked CORS Origin:", origin);
    return callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json({ limit: "30mb" }));
app.use(morgan("dev"));

// لا تنسى إضافة الـ Routes ومنفذ التشغيل (Port) هنا في نهاية الملف
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
