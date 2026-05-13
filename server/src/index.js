```js
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
  "http://127.0.0.1:5173",
  "http://172.20.10.2:5173",
  "https://evs-inspection-system-dem.vercel.app",
  ...configuredOrigins
]);

function isAllowedOrigin(origin) {
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

    return callback(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.options("*", cors());

app.use(express.json({ limit: "30mb" }));
app.use(morgan("dev"));
```
