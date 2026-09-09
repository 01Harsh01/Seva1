// ============================================================
//  js/store.js
//  SevaSetu Cooperative Marketplace — local data layer.
//
//  No backend/Firebase is wired up. All data lives in the
//  browser's localStorage so the app is fully demoable and
//  deployable as a static site.
// ============================================================

const KEYS = {
  USERS: "hs_users",
  WORKERS: "hs_workers",
  BOOKINGS: "hs_bookings",
  PAYMENTS: "hs_payments",
  INVOICES: "hs_invoices",
  REVIEWS: "hs_reviews",
  WELFARE: "hs_welfare",
  WELFARE_CLAIMS: "hs_welfare_claims",
  DISPUTES: "hs_disputes",
  NOTIFICATIONS: "hs_notifications",
  SESSION: "hs_session",
  SEEDED: "hs_seeded_v2",
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}
function uid(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------
// Categories & skill taxonomy
// ---------------------------------------------------------------
export const CATEGORIES = [
  { id: "electrical", label: "Electrical", icon: "⚡", rateMin: 250, rateMax: 1000,
    skills: ["Wiring", "Switch installation", "Fan installation", "Appliance repair"] },
  { id: "plumbing", label: "Plumbing", icon: "🔧", rateMin: 300, rateMax: 800,
    skills: ["Pipe repair", "Leakage repair", "Bathroom installation", "Water tank repair"] },
  { id: "carpentry", label: "Carpentry", icon: "🪚", rateMin: 350, rateMax: 1200,
    skills: ["Furniture repair", "Door repair", "Woodwork", "Modular furniture"] },
  { id: "painting", label: "Painting", icon: "🎨", rateMin: 400, rateMax: 1500,
    skills: ["Interior painting", "Exterior painting", "Waterproofing", "Texture work"] },
  { id: "cleaning", label: "Cleaning", icon: "🧹", rateMin: 200, rateMax: 700,
    skills: ["Deep cleaning", "Sofa cleaning", "Bathroom cleaning", "Move-in cleaning"] },
  { id: "domestic", label: "Domestic Help", icon: "🏠", rateMin: 200, rateMax: 600,
    skills: ["Cooking", "Housekeeping", "Laundry", "Elderly assistance"] },
  { id: "caregiving", label: "Caregiving", icon: "🩺", rateMin: 300, rateMax: 900,
    skills: ["Elder care", "Patient care", "Child care", "Post-surgery care"] },
  { id: "driving", label: "Driving", icon: "🚗", rateMin: 300, rateMax: 800,
    skills: ["Local driving", "Outstation driving", "Commercial license", "Two-wheeler delivery"] },
  { id: "gardening", label: "Gardening", icon: "🌿", rateMin: 200, rateMax: 600,
    skills: ["Lawn care", "Pruning", "Landscaping", "Pest control"] },
  { id: "technician", label: "Technician", icon: "🛠️", rateMin: 300, rateMax: 1200,
    skills: ["AC repair", "Fridge repair", "Washing machine repair", "TV/electronics repair"] },
];

export function getCategory(id) {
  return CATEGORIES.find((c) => c.id === id);
}

// ---------------------------------------------------------------
// Session / auth (local, role based)
// ---------------------------------------------------------------
export function getSession() {
  return read(KEYS.SESSION, null);
}
export function setSession(session) {
  write(KEYS.SESSION, session);
}
export function logout() {
  localStorage.removeItem(KEYS.SESSION);
}

const DEMO_ACCOUNTS = {
  customer: {
    id: "demo_cust_01",
    role: "customer",
    name: "Demo Customer",
    email: "customer@sevasetu.demo",
    password: "demo1234",
    phone: "9800000001",
    createdAt: 1700000000000,
  },
  worker: {
    id: "demo_wuser_01",
    role: "worker",
    name: "Ramen Das",
    email: "worker1@sevasetu.demo",
    password: "demo1234",
    phone: "9800000003",
    createdAt: 1700000000000,
  },
  admin: {
    id: "demo_adm_01",
    role: "admin",
    name: "Cooperative Admin",
    email: "admin@sevasetu.demo",
    password: "demo1234",
    phone: "9800000002",
    createdAt: 1700000000000,
  },
};

export function ensureDemoUsers() {
  let users = read(KEYS.USERS, []);
  let workers = read(KEYS.WORKERS, []);
  let updated = false;

  if (!users || !users.length || !workers || !workers.length) {
    seedDemoData(true);
    return;
  }

  // Migrate any old @homesync.demo emails to @sevasetu.demo
  users.forEach((u) => {
    if (u.email && u.email.includes("@homesync.demo")) {
      u.email = u.email.replace("@homesync.demo", "@sevasetu.demo");
      updated = true;
    }
  });
  workers.forEach((w) => {
    if (w.email && w.email.includes("@homesync.demo")) {
      w.email = w.email.replace("@homesync.demo", "@sevasetu.demo");
      updated = true;
    }
  });

  // Ensure standard demo accounts exist and have password demo1234
  ["customer", "worker", "admin"].forEach((role) => {
    const demo = DEMO_ACCOUNTS[role];
    const idx = users.findIndex((u) => (u.email && u.email.toLowerCase() === demo.email) || u.id === demo.id);
    if (idx >= 0) {
      if (users[idx].password !== "demo1234" || users[idx].role !== role) {
        users[idx].password = "demo1234";
        users[idx].role = role;
        updated = true;
      }
    } else {
      users.push({ ...demo });
      updated = true;
    }
  });

  // Ensure worker1 in WORKERS table links to the demo worker user
  const w1 = workers.find((w) => w.email && w.email.toLowerCase() === DEMO_ACCOUNTS.worker.email);
  if (w1 && w1.userId !== DEMO_ACCOUNTS.worker.id) {
    w1.userId = DEMO_ACCOUNTS.worker.id;
    updated = true;
  }

  if (updated) {
    write(KEYS.USERS, users);
    write(KEYS.WORKERS, workers);
  }
}

export function findUserByEmail(email) {
  if (!email) return null;
  const clean = email.trim().toLowerCase();
  ensureDemoUsers();
  const users = read(KEYS.USERS, []);

  // 1. Direct email match
  let user = users.find((u) => u.email && u.email.trim().toLowerCase() === clean);
  if (user) return user;

  // 2. Domain alias match (@homesync.demo <-> @sevasetu.demo)
  const alt = clean.includes("@homesync.demo")
    ? clean.replace("@homesync.demo", "@sevasetu.demo")
    : clean.replace("@sevasetu.demo", "@homesync.demo");
  user = users.find((u) => u.email && u.email.trim().toLowerCase() === alt);
  if (user) return user;

  // 3. Demo shortcut handles (e.g. "customer", "worker", "worker1", "admin")
  const prefix = clean.split("@")[0];
  if (prefix === "customer" || prefix === "cust") return DEMO_ACCOUNTS.customer;
  if (prefix === "worker" || prefix === "worker1" || prefix === "w1") return DEMO_ACCOUNTS.worker;
  if (prefix === "admin" || prefix === "adm") return DEMO_ACCOUNTS.admin;

  user = users.find((u) => {
    const ue = (u.email || "").trim().toLowerCase();
    return ue.split("@")[0] === prefix;
  });
  if (user) return user;

  return null;
}

export function registerCustomer({ name, email, password, phone }) {
  const users = read(KEYS.USERS, []);
  if (findUserByEmail(email)) return { success: false, error: "An account with this email already exists." };
  const user = { id: uid("cust"), role: "customer", name, email: email.trim(), password: password.trim(), phone, createdAt: Date.now() };
  users.push(user);
  write(KEYS.USERS, users);
  setSession({ userId: user.id, role: "customer", name: user.name, email: user.email });
  return { success: true, user };
}

export function registerWorker(profile) {
  const users = read(KEYS.USERS, []);
  if (findUserByEmail(profile.email)) return { success: false, error: "An account with this email already exists." };
  const userId = uid("wuser");
  const user = { id: userId, role: "worker", name: profile.name, email: profile.email.trim(), password: profile.password.trim(), phone: profile.phone, createdAt: Date.now() };
  users.push(user);
  write(KEYS.USERS, users);

  const workers = read(KEYS.WORKERS, []);
  const worker = {
    id: uid("wkr"),
    userId,
    name: profile.name,
    phone: profile.phone,
    email: profile.email.trim(),
    address: profile.address || "",
    lat: profile.lat, lng: profile.lng,
    category: profile.category,
    skills: profile.skills || [],
    experience: Number(profile.experience) || 0,
    qualification: profile.qualification || "",
    certifications: profile.certifications || [],
    languages: profile.languages || ["English"],
    serviceRadiusKm: Number(profile.serviceRadiusKm) || 10,
    availability: "available",
    expectedRate: Number(profile.expectedRate) || getCategory(profile.category)?.rateMin || 300,
    emergencyContact: profile.emergencyContact || "",
    cooperativeMemberId: `SEVA-COOP-${Math.floor(1000 + Math.random() * 9000)}`,
    verificationStatus: "pending",
    photo: profile.photo || "",
    rating: 0,
    ratingCount: 0,
    completedJobs: 0,
    welfare: { insurance: "pending", scheme: "pending", training: [] },
    createdAt: Date.now(),
  };
  workers.push(worker);
  write(KEYS.WORKERS, workers);
  setSession({ userId, role: "worker", name: user.name, email: user.email });
  return { success: true, user, worker };
}

export function login(email, password, expectedRole) {
  if (!email || !email.trim()) return { success: false, error: "Please enter your email address." };
  if (!password) return { success: false, error: "Please enter your password." };

  const cleanEmail = email.trim();
  const cleanPass = password.trim();

  ensureDemoUsers();

  // Instant demo account authentication guarantee
  if (cleanPass === "demo1234") {
    const low = cleanEmail.toLowerCase();
    if (low.includes("cust")) {
      const u = DEMO_ACCOUNTS.customer;
      setSession({ userId: u.id, role: "customer", name: u.name, email: u.email });
      return { success: true, user: u };
    }
    if (low.includes("work")) {
      const u = DEMO_ACCOUNTS.worker;
      setSession({ userId: u.id, role: "worker", name: u.name, email: u.email });
      return { success: true, user: u };
    }
    if (low.includes("adm")) {
      const u = DEMO_ACCOUNTS.admin;
      setSession({ userId: u.id, role: "admin", name: u.name, email: u.email });
      return { success: true, user: u };
    }
  }

  const user = findUserByEmail(cleanEmail);

  if (!user || user.password !== cleanPass) {
    const isDemo = cleanEmail.includes("customer") || cleanEmail.includes("worker") || cleanEmail.includes("admin");
    if (isDemo && cleanPass !== "demo1234") {
      return { success: false, error: "Incorrect password. The demo account password is 'demo1234'." };
    }
    return { success: false, error: "Invalid email or password. Please verify your details or use 1-Click Demo Login." };
  }

  setSession({ userId: user.id, role: user.role, name: user.name, email: user.email });
  return { success: true, user };
}

export function currentUser() {
  const s = getSession();
  if (!s || !s.userId) return null;
  ensureDemoUsers();
  const users = read(KEYS.USERS, []);
  let u = users.find((u) => u.id === s.userId);
  if (!u && s.email) u = users.find((u) => u.email && u.email.toLowerCase() === s.email.toLowerCase());
  if (!u && s.role && DEMO_ACCOUNTS[s.role]) u = DEMO_ACCOUNTS[s.role];
  return u || null;
}

export function currentWorkerProfile() {
  const u = currentUser();
  if (!u || u.role !== "worker") return null;
  ensureDemoUsers();
  const workers = read(KEYS.WORKERS, []);
  if (!workers.length) {
    seedDemoData(true);
    return read(KEYS.WORKERS, [])[0] || null;
  }
  let w = workers.find((w) => w.userId === u.id || (w.email && u.email && w.email.toLowerCase() === u.email.toLowerCase()));
  if (!w) w = workers[0];
  if (w) {
    let touched = false;
    if (!Array.isArray(w.skills)) {
      const cat = getCategory(w.category);
      w.skills = cat ? cat.skills.slice(0, 3) : ["General Service"];
      touched = true;
    }
    if (!Array.isArray(w.certifications) || !w.certifications.length) {
      const cat = getCategory(w.category);
      w.certifications = [`Certified ${cat ? cat.label : "Trade"} Technician (NSDC Level 4)`];
      touched = true;
    }
    if (!w.welfare || typeof w.welfare !== "object") {
      w.welfare = {
        insurance: "covered",
        scheme: "enrolled",
        training: ["Electrical Safety & Earthing Protocols 2026", "Customer Etiquette & Fair Wage"],
        policyNumber: "SEVA-INS-8821",
        sumInsured: 200000,
      };
      touched = true;
    } else {
      if (!w.welfare.insurance) { w.welfare.insurance = "covered"; touched = true; }
      if (!w.welfare.scheme) { w.welfare.scheme = "enrolled"; touched = true; }
      if (!Array.isArray(w.welfare.training) || !w.welfare.training.length) {
        w.welfare.training = ["Electrical Safety & Earthing Protocols 2026"];
        touched = true;
      }
      if (!w.welfare.policyNumber) { w.welfare.policyNumber = "SEVA-INS-8821"; touched = true; }
      if (!w.welfare.sumInsured) { w.welfare.sumInsured = 200000; touched = true; }
    }
    if (!Array.isArray(w.shifts) || !w.shifts.length) {
      w.shifts = ["Morning (8 AM - 1 PM)", "Afternoon (1 PM - 6 PM)"];
      touched = true;
    }
    if (!Array.isArray(w.workingDays) || !w.workingDays.length) {
      w.workingDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      touched = true;
    }
    if (w.emergencyOptIn === undefined) {
      w.emergencyOptIn = true;
      touched = true;
    }
    if (!w.bankDetails) {
      w.bankDetails = {
        account: "9876543210123",
        ifsc: "SBIN0001234",
        bank: "State Bank of India (Guwahati)",
        upi: `${(w.name || "worker").toLowerCase().replace(/\s+/g, "")}@oksbi`,
      };
      touched = true;
    }
    if (!Array.isArray(w.payouts) || !w.payouts.length) {
      w.payouts = [
        { id: "po_1", amount: 2400, date: "2026-09-05", method: "UPI", status: "completed", reference: "UPI/260905/78219" },
        { id: "po_2", amount: 1850, date: "2026-08-28", method: "Bank Transfer", status: "completed", reference: "NEFT/260828/44120" },
      ];
      touched = true;
    }
    if (!Array.isArray(w.courses) || !w.courses.length) {
      w.courses = [
        { id: "course_1", title: "Electrical Safety & Earthing Protocols 2026", status: "completed", score: "98%", date: "Aug 2026" },
        { id: "course_2", title: "Customer Etiquette & Fair Wage Ethics", status: "completed", score: "95%", date: "Jul 2026" },
      ];
      touched = true;
    }
    if (!w.experience) { w.experience = 5; touched = true; }
    if (!w.rating) { w.rating = 4.9; touched = true; }
    if (!w.ratingCount) { w.ratingCount = 38; touched = true; }
    if (!w.completedJobs) { w.completedJobs = 42; touched = true; }
    if (!w.serviceRadiusKm) { w.serviceRadiusKm = 12; touched = true; }
    if (!w.expectedRate) { w.expectedRate = 450; touched = true; }

    if (touched) saveWorker(w);
    ensureWorkerDemoBookings(w.id);
  }
  return w || null;
}

export function requireAuth(role) {
  const s = getSession();
  const base = location.pathname.replace(/\/[^/]*$/, "/");
  if (!s || (role && s.role !== role)) {
    location.href = base + "login.html";
    return false;
  }
  return true;
}

// ---------------------------------------------------------------
// Workers
// ---------------------------------------------------------------
export function getWorkers() {
  return read(KEYS.WORKERS, []);
}
export function getWorkerById(id) {
  return getWorkers().find((w) => w.id === id);
}
export function saveWorker(worker) {
  const workers = getWorkers();
  const i = workers.findIndex((w) => w.id === worker.id);
  if (i >= 0) workers[i] = worker; else workers.push(worker);
  write(KEYS.WORKERS, workers);
}
export function setWorkerVerification(id, status) {
  const w = getWorkerById(id);
  if (!w) return;
  w.verificationStatus = status;
  saveWorker(w);
  notify(w.userId, `Your verification status changed to "${status.replace("_", " ")}".`);
}

// Haversine distance in km
export function distanceKm(lat1, lng1, lat2, lng2) {
  if ([lat1, lng1, lat2, lng2].some((v) => v === undefined || v === null || Number.isNaN(v))) return null;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Ranked, matched worker search (skill > distance > rating > experience > workload)
export function findMatches({ category, lat, lng, minRating = 0, maxPrice, availableOnly = false, verifiedOnly = true }) {
  let list = getWorkers().filter((w) => (category ? w.category === category : true));
  if (verifiedOnly) list = list.filter((w) => w.verificationStatus === "verified");
  if (availableOnly) list = list.filter((w) => w.availability === "available");
  if (minRating) list = list.filter((w) => w.rating >= minRating);
  if (maxPrice) list = list.filter((w) => w.expectedRate <= maxPrice);

  const bookings = getBookings();
  return list
    .map((w) => {
      const dist = lat && lng ? distanceKm(lat, lng, w.lat, w.lng) : null;
      const workload = bookings.filter((b) => b.workerId === w.id && ["accepted", "scheduled", "in_progress"].includes(b.status)).length;
      // weighted match score, all bounded 0-100
      const distScore = dist === null ? 60 : Math.max(0, 100 - dist * 6);
      const ratingScore = (w.rating / 5) * 100;
      const expScore = Math.min(100, w.experience * 10);
      const workloadScore = Math.max(0, 100 - workload * 20);
      const availScore = w.availability === "available" ? 100 : 30;
      const score = distScore * 0.35 + ratingScore * 0.25 + expScore * 0.15 + workloadScore * 0.15 + availScore * 0.1;
      return { ...w, distanceKm: dist, matchScore: Math.round(score) };
    })
    .sort((a, b) => b.matchScore - a.matchScore);
}

// ---------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------
export function getBookings() {
  return read(KEYS.BOOKINGS, []);
}
function saveBookings(list) {
  write(KEYS.BOOKINGS, list);
}
export function getBookingById(id) {
  return getBookings().find((b) => b.id === id);
}
export function getBookingsForCustomer(customerId) {
  return getBookings().filter((b) => b.customerId === customerId).sort((a, b) => b.createdAt - a.createdAt);
}
export function getBookingsForWorker(workerId) {
  return getBookings().filter((b) => b.workerId === workerId).sort((a, b) => b.createdAt - a.createdAt);
}

export function createBooking(data) {
  const bookings = getBookings();
  const worker = getWorkerById(data.workerId);
  const booking = {
    id: uid("bkg"),
    customerId: data.customerId,
    customerName: data.customerName,
    workerId: data.workerId,
    workerName: worker?.name,
    category: data.category,
    date: data.date,
    time: data.time,
    address: data.address,
    description: data.description || "",
    details: data.details || {}, // dynamic category-specific booking answers
    paymentMethod: data.paymentMethod || "online",
    isEmergency: !!data.isEmergency,
    status: "requested", // requested|accepted|rejected|scheduled|in_progress|completed|cancelled
    serviceCharge: data.serviceCharge,
    additionalCharges: 0,
    createdAt: Date.now(),
  };
  bookings.push(booking);
  saveBookings(bookings);
  notify(worker?.userId, `New ${booking.isEmergency ? "EMERGENCY " : ""}booking request from ${data.customerName}.`);
  return booking;
}

export function updateBookingStatus(id, status) {
  const bookings = getBookings();
  const b = bookings.find((x) => x.id === id);
  if (!b) return null;
  b.status = status;
  b.updatedAt = Date.now();
  saveBookings(bookings);

  const worker = getWorkerById(b.workerId);
  if (status === "completed" && worker) {
    worker.completedJobs = (worker.completedJobs || 0) + 1;
    worker.availability = "available";
    saveWorker(worker);
  }
  if (status === "accepted" || status === "in_progress") {
    if (worker) { worker.availability = "busy"; saveWorker(worker); }
  }
  notify(null, `Booking ${id} status: ${status}`, b.customerId);
  return b;
}

export function addBookingAdditionalCharges(id, amount, note = "") {
  const bookings = getBookings();
  const b = bookings.find((x) => x.id === id);
  if (!b) return null;
  b.additionalCharges = (b.additionalCharges || 0) + Number(amount);
  if (note) {
    b.additionalNote = note;
  }
  saveBookings(bookings);
  return b;
}

// ---------------------------------------------------------------
// Payments & invoices
// ---------------------------------------------------------------
export function getPayments() {
  return read(KEYS.PAYMENTS, []);
}
export function recordPayment({ bookingId, amount, method, status }) {
  const payments = getPayments();
  const payment = {
    id: uid("pay"),
    bookingId,
    amount,
    method, // online | cash
    status, // success | failed | pending
    transactionId: method === "online" ? `TXN${Date.now()}${Math.floor(Math.random() * 1000)}` : "CASH",
    createdAt: Date.now(),
  };
  payments.push(payment);
  write(KEYS.PAYMENTS, payments);
  return payment;
}

export function generateInvoice(bookingId) {
  const invoices = read(KEYS.INVOICES, []);
  const existing = invoices.find((i) => i.bookingId === bookingId);
  if (existing) return existing;

  const booking = getBookingById(bookingId);
  const payment = getPayments().filter((p) => p.bookingId === bookingId).slice(-1)[0];
  const worker = getWorkerById(booking.workerId);
  const cooperativeFeePct = 0.08; // 8% cooperative fee, transparent
  const labourCharge = booking.serviceCharge;
  const additional = booking.additionalCharges || 0;
  const subtotal = labourCharge + additional;
  const cooperativeFee = Math.round(subtotal * cooperativeFeePct);
  const total = subtotal + cooperativeFee;
  const workerEarning = subtotal - Math.round(subtotal * 0.03); // 3% deducted toward welfare fund

  const invoice = {
    id: uid("inv"),
    invoiceNumber: `SS/${new Date().getFullYear()}/${Math.floor(10000 + Math.random() * 89999)}`,
    bookingId,
    customerName: booking.customerName,
    workerName: worker?.name,
    cooperative: "SevaSetu Labour Cooperative Society",
    category: booking.category,
    date: booking.date,
    labourCharge,
    additionalCharges: additional,
    cooperativeFee,
    total,
    workerEarning,
    paymentStatus: payment ? payment.status : "pending",
    transactionId: payment ? payment.transactionId : "-",
    createdAt: Date.now(),
  };
  invoices.push(invoice);
  write(KEYS.INVOICES, invoices);
  return invoice;
}
export function getInvoiceForBooking(bookingId) {
  return read(KEYS.INVOICES, []).find((i) => i.bookingId === bookingId);
}

// ---------------------------------------------------------------
// Reviews / ratings
// ---------------------------------------------------------------
export function getReviews() {
  return read(KEYS.REVIEWS, []);
}
export function addReview({ bookingId, workerId, overall, quality, professionalism, timeliness, comment }) {
  const reviews = getReviews();
  if (reviews.some((r) => r.bookingId === bookingId)) {
    return { success: false, error: "This booking has already been reviewed." };
  }
  const review = { id: uid("rev"), bookingId, workerId, overall, quality, professionalism, timeliness, comment, createdAt: Date.now() };
  reviews.push(review);
  write(KEYS.REVIEWS, reviews);

  const worker = getWorkerById(workerId);
  if (worker) {
    const all = reviews.filter((r) => r.workerId === workerId);
    const avg = all.reduce((s, r) => s + r.overall, 0) / all.length;
    worker.rating = Math.round(avg * 10) / 10;
    worker.ratingCount = all.length;
    saveWorker(worker);
  }
  return { success: true, review };
}

// ---------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------
export function notify(toUserId, message, toCustomerIdFallback) {
  const list = read(KEYS.NOTIFICATIONS, []);
  list.unshift({ id: uid("ntf"), toUserId: toUserId || toCustomerIdFallback, message, read: false, createdAt: Date.now() });
  write(KEYS.NOTIFICATIONS, list.slice(0, 300));
}
export function getNotifications(userId) {
  return read(KEYS.NOTIFICATIONS, []).filter((n) => n.toUserId === userId);
}

// ---------------------------------------------------------------
// Worker welfare
// ---------------------------------------------------------------
export function updateWelfare(workerId, welfare) {
  const w = getWorkerById(workerId);
  if (!w) return;
  w.welfare = { ...w.welfare, ...welfare };
  saveWorker(w);
}

export function getWelfareClaims() {
  return read(KEYS.WELFARE_CLAIMS, []);
}

export function updateWelfareClaim(id, status, resolutionNote = "") {
  const list = getWelfareClaims();
  const c = list.find((x) => x.id === id);
  if (!c) return null;
  c.status = status;
  c.resolvedAt = Date.now();
  if (resolutionNote) c.resolutionNote = resolutionNote;
  write(KEYS.WELFARE_CLAIMS, list);
  return c;
}

// ---------------------------------------------------------------
// Disputes
// ---------------------------------------------------------------
export function getDisputes() {
  return read(KEYS.DISPUTES, []);
}
export function fileDispute({ bookingId, raisedBy, reason }) {
  const list = getDisputes();
  const d = { id: uid("dsp"), bookingId, raisedBy, reason, status: "open", createdAt: Date.now() };
  list.push(d);
  write(KEYS.DISPUTES, list);
  return d;
}
export function resolveDispute(id, resolution) {
  const list = getDisputes();
  const d = list.find((x) => x.id === id);
  if (!d) return;
  d.status = "resolved";
  d.resolution = resolution;
  write(KEYS.DISPUTES, list);
}

// ---------------------------------------------------------------
// AI-assisted demand forecasting
// ---------------------------------------------------------------
export function demandForecast() {
  const bookings = getBookings();
  const now = Date.now();
  const DAY = 86400000;
  return CATEGORIES.map((cat) => {
    const recent = bookings.filter((b) => b.category === cat.id && now - b.createdAt < 14 * DAY).length;
    const older = bookings.filter((b) => b.category === cat.id && now - b.createdAt >= 14 * DAY && now - b.createdAt < 28 * DAY).length;
    const growth = older === 0 ? (recent > 0 ? 100 : 0) : Math.round(((recent - older) / older) * 100);
    let level = "Low";
    if (recent >= 8 || growth >= 40) level = "Very High";
    else if (recent >= 5 || growth >= 20) level = "High";
    else if (recent >= 2) level = "Medium";
    return { category: cat.id, label: cat.label, icon: cat.icon, recentBookings: recent, growthPct: growth, level };
  }).sort((a, b) => b.recentBookings - a.recentBookings);
}

export function workforceAllocation() {
  const forecast = demandForecast();
  const workers = getWorkers().filter((w) => w.verificationStatus === "verified");
  const recs = [];
  forecast.forEach((f) => {
    const available = workers.filter((w) => w.category === f.category && w.availability === "available").length;
    if ((f.level === "High" || f.level === "Very High") && available < 3) {
      recs.push(`Increase ${f.label.toLowerCase()} availability — demand is ${f.level.toLowerCase()} but only ${available} worker(s) currently marked available.`);
    }
    if (f.level === "Low" && available > 4) {
      recs.push(`Consider reallocating some ${f.label.toLowerCase()} workers — demand is low relative to ${available} available worker(s).`);
    }
  });
  if (recs.length === 0) recs.push("Current worker availability is well balanced against forecasted demand across categories.");
  return recs;
}

// ---------------------------------------------------------------
// Admin dashboard stats
// ---------------------------------------------------------------
export function adminStats() {
  ensureAdminDemoData();
  const workers = getWorkers();
  const bookings = getBookings();
  const payments = getPayments();
  const users = read(KEYS.USERS, []);
  const revenue = payments.filter((p) => p.status === "success").reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const verified = workers.filter((w) => w.verificationStatus === "verified");
  const rated = verified.filter((w) => Number(w.rating) > 0);
  const avgRating = rated.length ? rated.reduce((s, w) => s + (Number(w.rating) || 0), 0) / rated.length : 4.8;
  return {
    totalWorkers: workers.length,
    verifiedWorkers: verified.length,
    pendingVerification: workers.filter((w) => w.verificationStatus === "pending" || w.verificationStatus === "under_review").length,
    totalCustomers: users.filter((u) => u.role === "customer").length,
    activeBookings: bookings.filter((b) => ["requested", "accepted", "scheduled", "in_progress"].includes(b.status)).length,
    completedBookings: bookings.filter((b) => b.status === "completed").length,
    emergencyRequests: bookings.filter((b) => b.isEmergency).length,
    totalRevenue: revenue,
    avgRating: Math.round((avgRating || 4.8) * 10) / 10,
    welfareCovered: workers.filter((w) => w.welfare?.insurance === "covered").length,
  };
}

// ---------------------------------------------------------------
// Demo data seeding
// ---------------------------------------------------------------
export function seedDemoData(force = false) {
  if (!force && read(KEYS.SEEDED, false)) return;

  const BASE = { lat: 26.1445, lng: 91.7362 }; // Guwahati, Assam — demo region
  const names = ["Ramen Das", "Priya Sharma", "Anil Bora", "Sunita Rai", "Manoj Kalita", "Farida Begum",
    "Dilip Sarma", "Rekha Devi", "Bikash Gogoi", "Meena Kumari", "Suresh Yadav", "Tanvir Ahmed",
    "Purnima Baruah", "Jagat Deka", "Rina Boro", "Ashok Nath", "Lakhi Pathak", "Salim Khan"];
  const workers = [];
  const users = [];
  names.forEach((name, i) => {
    const cat = CATEGORIES[i % CATEGORIES.length];
    const userId = uid("wuser");
    const rating = Math.round((3.5 + Math.random() * 1.5) * 10) / 10;
    const verification = i < 14 ? "verified" : i < 16 ? "under_review" : "pending";
    users.push({ id: userId, role: "worker", name, email: `worker${i + 1}@sevasetu.demo`, password: "demo1234", phone: `9${Math.floor(100000000 + Math.random() * 899999999)}`, createdAt: Date.now() });
    workers.push({
      id: uid("wkr"), userId, name,
      phone: `9${Math.floor(100000000 + Math.random() * 899999999)}`,
      email: `worker${i + 1}@sevasetu.demo`,
      address: `${["Fancy Bazar", "Ganeshguri", "Dispur", "Beltola", "Zoo Road", "Six Mile", "Chandmari", "Paltan Bazar"][i % 8]}, Guwahati`,
      lat: BASE.lat + (Math.random() - 0.5) * 0.15,
      lng: BASE.lng + (Math.random() - 0.5) * 0.15,
      category: cat.id,
      skills: cat.skills.slice(0, 2 + (i % 3)),
      experience: 1 + (i % 12),
      qualification: ["ITI Certified", "Diploma Holder", "Trade Certified", "On-the-job Trained"][i % 4],
      certifications: [`${cat.label} Trade Certificate`],
      languages: ["Assamese", "Hindi", "English"].slice(0, 1 + (i % 3)),
      serviceRadiusKm: 5 + (i % 4) * 3,
      availability: i % 5 === 0 ? "busy" : "available",
      expectedRate: cat.rateMin + Math.floor(Math.random() * (cat.rateMax - cat.rateMin)),
      emergencyContact: "112",
      cooperativeMemberId: `SEVA-COOP-${1000 + i}`,
      verificationStatus: verification,
      photo: "",
      rating: verification === "verified" ? rating : 0,
      ratingCount: verification === "verified" ? 5 + (i % 20) : 0,
      completedJobs: verification === "verified" ? 5 + (i % 40) : 0,
      welfare: {
        insurance: i % 3 === 0 ? "covered" : "pending",
        scheme: i % 2 === 0 ? "enrolled" : "pending",
        training: i % 4 === 0 ? ["Safety Training 2025"] : [],
      },
      createdAt: Date.now() - i * 86400000,
    });
  });

  const custUsers = [
    { id: uid("cust"), role: "customer", name: "Demo Customer", email: "customer@sevasetu.demo", password: "demo1234", phone: "9800000001", createdAt: Date.now() },
  ];
  const adminUsers = [
    { id: uid("adm"), role: "admin", name: "Cooperative Admin", email: "admin@sevasetu.demo", password: "demo1234", phone: "9800000002", createdAt: Date.now() },
  ];

  write(KEYS.USERS, [...users, ...custUsers, ...adminUsers]);
  write(KEYS.WORKERS, workers);

  // Historical bookings for the forecast module to have something to chew on
  const bookings = [];
  const custId = custUsers[0].id;
  const verifiedWorkers = workers.filter((w) => w.verificationStatus === "verified");
  for (let i = 0; i < 60; i++) {
    const w = verifiedWorkers[Math.floor(Math.random() * verifiedWorkers.length)];
    const daysAgo = Math.floor(Math.random() * 40);
    const created = Date.now() - daysAgo * 86400000;
    bookings.push({
      id: uid("bkg"), customerId: custId, customerName: "Demo Customer",
      workerId: w.id, workerName: w.name, category: w.category,
      date: new Date(created).toISOString().slice(0, 10), time: "10:00",
      address: "Demo address, Guwahati", description: "Historical demo booking",
      paymentMethod: Math.random() > 0.5 ? "online" : "cash",
      isEmergency: Math.random() < 0.12,
      status: "completed",
      serviceCharge: w.expectedRate,
      additionalCharges: 0,
      createdAt: created,
    });
  }
  write(KEYS.BOOKINGS, bookings);

  const payments = bookings.map((b) => ({
    id: uid("pay"), bookingId: b.id, amount: Math.round(b.serviceCharge * 1.08),
    method: b.paymentMethod, status: "success",
    transactionId: b.paymentMethod === "online" ? `TXN${b.createdAt}` : "CASH",
    createdAt: b.createdAt,
  }));
  write(KEYS.PAYMENTS, payments);

  write(KEYS.SEEDED, true);
}

export function recordWorkerPayout(workerId, { amount, method, account }) {
  const worker = getWorkerById(workerId);
  if (!worker) return null;
  if (!Array.isArray(worker.payouts)) worker.payouts = [];
  const payout = {
    id: uid("po"),
    amount: Number(amount) || 0,
    method: method || "UPI",
    account: account || "Default UPI",
    date: new Date().toISOString().slice(0, 10),
    timestamp: Date.now(),
    status: "completed",
    reference: `SEVA/${Date.now().toString().slice(-6)}/${Math.floor(1000 + Math.random() * 9000)}`,
  };
  worker.payouts.unshift(payout);
  saveWorker(worker);
  return payout;
}

export function enrollWorkerCourse(workerId, course) {
  const worker = getWorkerById(workerId);
  if (!worker) return null;
  if (!Array.isArray(worker.courses)) worker.courses = [];
  const exists = worker.courses.find((c) => c.id === course.id);
  if (!exists) {
    worker.courses.push({
      ...course,
      enrolledAt: Date.now(),
      status: "enrolled",
      progress: "In Progress (Module 1/4)",
    });
    if (!worker.welfare) worker.welfare = {};
    if (!Array.isArray(worker.welfare.training)) worker.welfare.training = [];
    if (!worker.welfare.training.includes(course.title)) {
      worker.welfare.training.push(course.title);
    }
    saveWorker(worker);
  }
  return worker;
}

export function ensureWorkerDemoBookings(workerId, force = false) {
  if (!workerId) return;
  const allBookings = getBookings();
  const workerBookings = allBookings.filter((b) => b.workerId === workerId);
  const activeCount = workerBookings.filter((b) => ["requested", "accepted", "in_progress"].includes(b.status)).length;

  if (!force && activeCount >= 2 && workerBookings.length >= 4) {
    return;
  }

  const worker = getWorkerById(workerId);
  const cat = worker?.category || "electrical";
  const now = Date.now();
  const DAY = 86400000;

  // Filter out previous demo bookings for this worker if force is requested
  let remaining = force
    ? allBookings.filter((b) => b.workerId !== workerId)
    : allBookings.filter((b) => !b.id.startsWith(`demo_wbkg_${workerId}_`));

  const demoJobs = [
    {
      id: `demo_wbkg_${workerId}_01`,
      customerId: "demo_cust_02",
      customerName: "Anita Goswami",
      customerPhone: "+91 98640 12345",
      workerId,
      workerName: worker?.name || "Ramen Das",
      category: cat,
      date: new Date(now).toISOString().slice(0, 10),
      time: "3:30 PM",
      address: "Flat 4B, Silver Heights, Zoo Road, Guwahati",
      distance: "2.1 km away",
      description: "Urgent: Short circuit in master bedroom switchboard with sparking observed. Need safety check and repair.",
      details: { Urgency: "Immediate / Emergency", Room: "Master Bedroom", Issue: "Sparking & Tripping" },
      paymentMethod: "online",
      isEmergency: true,
      status: "requested",
      serviceCharge: 650,
      additionalCharges: 0,
      createdAt: now - 35 * 60 * 1000,
    },
    {
      id: `demo_wbkg_${workerId}_02`,
      customerId: "demo_cust_03",
      customerName: "Manoj Baruah",
      customerPhone: "+91 94350 11223",
      address: "House 12, By-Lane 2, Lachit Nagar, Guwahati",
      distance: "3.5 km away",
      workerId,
      workerName: worker?.name || "Ramen Das",
      category: cat,
      date: new Date(now).toISOString().slice(0, 10),
      time: "5:00 PM",
      description: "Installation of heavy-duty 16A power socket and dedicated MCB wiring for split air conditioner.",
      details: { Appliance: "Split AC (1.5 Ton)", SocketType: "16A Heavy Duty", Location: "Living Room" },
      paymentMethod: "online",
      isEmergency: false,
      status: "requested",
      serviceCharge: 500,
      additionalCharges: 0,
      createdAt: now - 2 * 3600 * 1000,
    },
    {
      id: `demo_wbkg_${workerId}_03`,
      customerId: "demo_cust_04",
      customerName: "Bhaskar Barman",
      customerPhone: "+91 94350 98765",
      address: "House 18, By-lane 3, Rajgarh Road, Guwahati",
      distance: "1.8 km away",
      workerId,
      workerName: worker?.name || "Ramen Das",
      category: cat,
      date: new Date(now).toISOString().slice(0, 10),
      time: "11:30 AM",
      description: "Ceiling fan replacement, regulator installation and study room LED concealed wiring check.",
      details: { Task: "Fan Installation & Regulator", Rooms: "Study Room", PartsProvided: "Fan provided by customer" },
      paymentMethod: "cash",
      isEmergency: false,
      status: "in_progress",
      serviceCharge: 450,
      additionalCharges: 120,
      createdAt: now - 5 * 3600 * 1000,
    },
    {
      id: `demo_wbkg_${workerId}_04`,
      customerId: "demo_cust_05",
      customerName: "Pranab Phukan",
      customerPhone: "+91 98540 55432",
      address: "Plot 12, VIP Road, Six Mile, Guwahati",
      distance: "4.2 km away",
      workerId,
      workerName: worker?.name || "Ramen Das",
      category: cat,
      date: new Date(now + DAY).toISOString().slice(0, 10),
      time: "10:00 AM",
      description: "Kitchen exhaust fan socket replacement and inspection of main distribution MCB box.",
      details: { Task: "Exhaust Socket & MCB Check", Priority: "Scheduled Next Day" },
      paymentMethod: "online",
      isEmergency: false,
      status: "accepted",
      serviceCharge: 550,
      additionalCharges: 0,
      createdAt: now - 10 * 3600 * 1000,
    },
    {
      id: `demo_wbkg_${workerId}_05`,
      customerId: "demo_cust_01",
      customerName: "Demo Customer",
      customerPhone: "+91 98000 00001",
      address: "Flat 2A, Green View Apartments, Christian Basti, Guwahati",
      distance: "2.8 km away",
      workerId,
      workerName: worker?.name || "Ramen Das",
      category: cat,
      date: new Date(now - DAY).toISOString().slice(0, 10),
      time: "2:00 PM",
      description: "Complete living room and dining chandelier wiring with two-way switch installation.",
      details: { Fixture: "Chandelier & 2-Way Switches", HoursWorked: "2.5 Hours", CompletedOn: "Yesterday" },
      paymentMethod: "online",
      isEmergency: false,
      status: "completed",
      serviceCharge: 850,
      additionalCharges: 250,
      createdAt: now - DAY - 2 * 3600 * 1000,
    },
    {
      id: `demo_wbkg_${workerId}_06`,
      customerId: "demo_cust_06",
      customerName: "Debojit Kalita",
      customerPhone: "+91 98642 77123",
      address: "Bora Service, G.S. Road, Guwahati",
      distance: "3.0 km away",
      workerId,
      workerName: worker?.name || "Ramen Das",
      category: cat,
      date: new Date(now - 3 * DAY).toISOString().slice(0, 10),
      time: "4:00 PM",
      description: "Inverter backup connection and battery terminal maintenance with heavy cabling.",
      details: { Equipment: "Pure Sinewave Inverter 1000VA", CableGrade: "6 sq mm", BatteryChecked: "Yes" },
      paymentMethod: "online",
      isEmergency: false,
      status: "completed",
      serviceCharge: 750,
      additionalCharges: 180,
      createdAt: now - 3 * DAY,
    },
    {
      id: `demo_wbkg_${workerId}_07`,
      customerId: "demo_cust_07",
      customerName: "Monojit Saikia",
      customerPhone: "+91 97060 44321",
      address: "Uzan Bazar, Near Ghat, Guwahati",
      distance: "5.1 km away",
      workerId,
      workerName: worker?.name || "Ramen Das",
      category: cat,
      date: new Date(now - 7 * DAY).toISOString().slice(0, 10),
      time: "1:30 PM",
      description: "Submersible pump starter switch repair and float sensor replacement.",
      details: { Machine: "1.5 HP Submersible", StarterReplaced: "Yes", TestingDone: "Water flow verified" },
      paymentMethod: "cash",
      isEmergency: true,
      status: "completed",
      serviceCharge: 950,
      additionalCharges: 300,
      createdAt: now - 7 * DAY,
    },
  ];

  const existingIds = new Set(remaining.map((b) => b.id));
  demoJobs.forEach((job) => {
    if (!existingIds.has(job.id)) {
      remaining.push(job);
    }
  });

  saveBookings(remaining);

  const payments = getPayments();
  const paymentBookingIds = new Set(payments.map((p) => p.bookingId));
  demoJobs
    .filter((b) => b.status === "completed")
    .forEach((b) => {
      if (!paymentBookingIds.has(b.id)) {
        payments.push({
          id: `pay_${b.id}`,
          bookingId: b.id,
          amount: Math.round((b.serviceCharge + (b.additionalCharges || 0)) * 1.08),
          method: b.paymentMethod || "online",
          status: "success",
          transactionId: b.paymentMethod === "cash" ? "CASH_COLLECTED" : `TXN_${b.createdAt}`,
          createdAt: b.createdAt,
        });
      }
      generateInvoice(b.id);
    });
  write(KEYS.PAYMENTS, payments);
}

export function ensureAdminDemoData(force = false) {
  // 1. Ensure Disputes
  let disputes = getDisputes();
  if (force || !disputes.length) {
    disputes = [
      {
        id: "dsp_demo_01",
        bookingId: "bkg_zoo_821",
        customerName: "Pooja Talukdar",
        workerName: "Tanvir Ahmed",
        raisedBy: "Pooja Talukdar (Customer)",
        reason: "Technician arrived 28 minutes late due to monsoon waterlogging in Zoo Road. Customer requested cancellation waiver.",
        status: "open",
        createdAt: Date.now() - 4 * 3600 * 1000,
      },
      {
        id: "dsp_demo_02",
        bookingId: "bkg_gsr_904",
        customerName: "Kishore Sharma",
        workerName: "Salim Khan",
        raisedBy: "Kishore Sharma (Customer)",
        reason: "Discrepancy in copper pipe fitting charges (₹220 billed vs ₹150 verbally estimated). Need invoice review.",
        status: "open",
        createdAt: Date.now() - 14 * 3600 * 1000,
      },
      {
        id: "dsp_demo_03",
        bookingId: "bkg_sil_412",
        customerName: "Arunav Das",
        workerName: "Ramen Das",
        raisedBy: "Arunav Das (Customer)",
        reason: "Customer noted switch plate was slightly tilted during installation.",
        status: "resolved",
        resolution: "Worker revisited within 2 hours, re-calibrated the modular plate with zero additional cost. Customer confirmed 5-star satisfaction.",
        createdAt: Date.now() - 2 * 86400000,
      },
    ];
    write(KEYS.DISPUTES, disputes);
  }

  // 2. Ensure Welfare Claims
  let claims = getWelfareClaims();
  if (force || !claims.length) {
    claims = [
      {
        id: "wclm_demo_01",
        workerName: "Ramen Das",
        workerId: "demo_wuser_01",
        type: "Medical OPD Reimbursement",
        amount: 1850,
        status: "pending",
        hospital: "Down Town Hospital (Dispur)",
        date: "2026-09-08",
        description: "Minor electrical spark flash consultation and antibiotic eye drops prescription.",
        submittedAt: Date.now() - 24 * 3600 * 1000,
      },
      {
        id: "wclm_demo_02",
        workerName: "Sunita Rai",
        workerId: "wkr_sunita_rai",
        type: "Equipment Replacement Advance",
        amount: 3200,
        status: "pending",
        hospital: "N/A (Equipment Vendor)",
        date: "2026-09-07",
        description: "High-pressure washer motor burn during deep grease job. 0% interest cooperative equipment advance requested.",
        submittedAt: Date.now() - 48 * 3600 * 1000,
      },
      {
        id: "wclm_demo_03",
        workerName: "Anil Bora",
        workerId: "wkr_anil_bora",
        type: "Child Educational Scholarship",
        amount: 5000,
        status: "approved",
        hospital: "N/A (Assam Higher Secondary Board)",
        date: "2026-08-25",
        description: "Annual cooperative merit scholarship for daughter securing 92% in Class 10 Board examinations.",
        submittedAt: Date.now() - 15 * 86400000,
        resolutionNote: "Approved by Cooperative Welfare Committee. Amount disbursed directly to bank account.",
      },
    ];
    write(KEYS.WELFARE_CLAIMS, claims);
  }
}

export function resetDemoData() {
  Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
  seedDemoData(true);
}
