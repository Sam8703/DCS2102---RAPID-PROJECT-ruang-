// ==========================================================================
// RUANG HOMESTAY - MAIN LOGIC
// ==========================================================================

// Helper: Format number into Malaysian Ringgit currency (RM 00.00)
const money = (val) => `RM ${Number(val).toFixed(2)}`;

// Helper: Escape HTML strings to prevent XSS injection
const e = (val) => String(val ?? "").replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[c]);

// Helper: Get today's date formatted as YYYY-MM-DD
function today(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit", day: "2-digit"
  }).format(now);
}

let selectedPricingDate = "";

function priceDateLabel(date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC", weekday: "short", day: "numeric", month: "short", year: "numeric"
  }).format(new Date(`${date}T00:00:00Z`));
}

// Selected-date prices are previews; stored rates remain base rates.
function dailyRateMarkup(baseRate, now = new Date()) {
  const date = selectedPricingDate || today(now);
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  const isWeekend = day === 0 || day === 6;
  const baseCents = Math.round(Number(baseRate) * 100);
  const surchargeCents = isWeekend ? Math.round(baseCents * 0.1) : 0;
  return `<span><strong>${money((baseCents + surchargeCents) / 100)}</strong> <small>/ night</small></span>
    <small class="daily-rate-note">${selectedPricingDate ? priceDateLabel(date) : "Today"}: ${isWeekend
      ? `weekend rate (+10%, +${money(surchargeCents / 100)})`
      : "standard rate"}</small>`;
}

function refreshDisplayedRates() {
  const input = document.querySelector("#price-search-date");
  if (input) input.min = today();
  if (selectedPricingDate && selectedPricingDate < today()) {
    selectedPricingDate = "";
    if (input) input.value = today();
  }
  const status = document.querySelector("#date-price-status");
  if (status) status.textContent = `Showing nightly prices for ${priceDateLabel(selectedPricingDate || today())}. 5% off the total when booking 3 nights or more.`;
  document.querySelectorAll("[data-daily-rate]").forEach(el => {
    const markup = dailyRateMarkup(el.dataset.dailyRate);
    if (el.innerHTML !== markup) el.innerHTML = markup;
  });
}

function setupDatePriceSearch() {
  const form = document.querySelector("#date-price-form");
  const input = document.querySelector("#price-search-date");
  input.min = today();
  input.value = today();
  form.onsubmit = ev => {
    ev.preventDefault();
    if (!form.reportValidity()) return;
    selectedPricingDate = input.value;
    refreshDisplayedRates();
    if (location.hash !== "#explore") location.hash = "#explore";
    route();
    document.querySelector("#view-explore").scrollIntoView({ block: "start" });
  };
  document.querySelector("#price-date-today").onclick = () => {
    input.value = today();
    selectedPricingDate = "";
    refreshDisplayedRates();
    if (location.hash !== "#explore") location.hash = "#explore";
    route();
    document.querySelector("#view-explore").scrollIntoView({ block: "start" });
  };
  document.querySelectorAll("[data-price-weekday]").forEach(button => {
    button.onclick = () => {
      const date = new Date(`${today()}T00:00:00Z`);
      date.setUTCDate(date.getUTCDate() + (Number(button.dataset.priceWeekday) - date.getUTCDay() + 7) % 7);
      input.value = date.toISOString().slice(0, 10);
      form.requestSubmit();
    };
  });
  refreshDisplayedRates();
}

// Helper: Calculate total nights between two dates
function nights(start, end) {
  const diff = (new Date(end) - new Date(start)) / 86400000;
  return diff > 0 ? Math.round(diff) : 1;
}

// Charge each occupied night; the checkout date is excluded.
function bookingPrice(start, end, rate) {
  const checkIn = new Date(`${start}T00:00:00Z`);
  const checkOut = new Date(`${end}T00:00:00Z`);
  const nightCount = (checkOut - checkIn) / 86400000;
  if (!Number.isInteger(nightCount) || nightCount < 1) return null;

  const baseCents = Math.round(Number(rate) * 100);
  let weekendNights = 0;
  for (let day = new Date(checkIn); day < checkOut; day.setUTCDate(day.getUTCDate() + 1)) {
    if (day.getUTCDay() === 0 || day.getUTCDay() === 6) weekendNights++;
  }
  const surchargeCents = weekendNights * Math.round(baseCents * 0.1);
  const subtotalCents = nightCount * baseCents + surchargeCents;
  const discountCents = nightCount >= 3 ? Math.round(subtotalCents * 0.05) : 0;
  return { nightCount, weekendNights, surcharge: surchargeCents / 100,
    discount: discountCents / 100, total: (subtotalCents - discountCents) / 100 };
}

// Helper: Render status badges with proper color classes
const badge = (status) => `<span class="badge ${e(status.toLowerCase())}">${e(status)}</span>`;

// ==========================================================================
// 1. STARTER DATA & APPLICATION STATE
// ==========================================================================

// Fallback homestay records matching local image assets
const defaultHomestays = [
  {
    id: "stay-1",
    ownerId: "owner-1",
    name: "Palm House",
    location: "Melaka",
    pricePerNight: 450,
    capacity: 6,
    description: "A spacious getaway with a welcoming porch and sunlit spaces near heritage streets.",
    facilities: ["Air conditioning", "Wi-Fi", "Private pool", "Kitchen"],
    images: ["images/PalmHouse.jpg", "images/PalmHouseK.jpg", "images/PalmHouseL.jpg", "images/PalmHouseP.jpg", "images/PalmHouseR.jpg"],
    type: "Bungalow",
    status: "Active"
  },
  {
    id: "stay-2",
    ownerId: "owner-2",
    name: "City Loft",
    location: "Kuala Lumpur",
    pricePerNight: 300,
    capacity: 4,
    description: "A furnished city retreat with floor-to-ceiling skyline views of the Petronas Twin Towers.",
    facilities: ["Air conditioning", "Wi-Fi", "Kitchen", "City view"],
    images: ["images/CityLoft.jpg", "images/CityLoftK.jpg", "images/CityLoftL.jpg", "images/CityLoftR.jpg"],
    type: "City apartment",
    status: "Active"
  },
  {
    id: "stay-3",
    ownerId: "owner-1",
    name: "Serene Home",
    location: "Penang",
    pricePerNight: 330,
    capacity: 5,
    description: "A contemporary modern townhouse tucked into a peaceful island neighbourhood.",
    facilities: ["Air conditioning", "Wi-Fi", "Kitchen", "Free parking"],
    images: ["images/SereneHome.jpg", "images/SereneHomeB.jpg", "images/SereneHomeK.jpg", "images/SereneHomeL.jpg", "images/SereneHomeR.jpg"],
    type: "Terrace house",
    status: "Active"
  },
  {
    id: "stay-4",
    ownerId: "owner-2",
    name: "Hillside Cabin",
    location: "Ipoh",
    pricePerNight: 220,
    capacity: 2,
    description: "A warm multi-level retreat with ambient rooftop lighting and hillside breezes.",
    facilities: ["Air conditioning", "Wi-Fi", "Mountain view", "Free parking"],
    images: ["images/HillsideCabin.jpg", "images/HillsideCabinK.jpg", "images/HillsideCabinR.jpg", "images/HillsideCabinV.jpg"],
    type: "Vacation house",
    status: "Active"
  }
];

// In-Memory application state
let appState = {
  users: [
    { id: "admin-1", name: "Amira Hassan", email: "admin@demo.test", contact: "0123456780", role: "Admin", status: "Enabled" },
    { id: "owner-1", name: "Daniel Tan", email: "daniel@demo.test", contact: "0123456781", role: "Owner", status: "Enabled" },
    { id: "owner-2", name: "Nur Aisyah", email: "aisyah@demo.test", contact: "0123456782", role: "Owner", status: "Enabled" },
    { id: "customer-1", name: "Sarah Lim", email: "sarah@demo.test", contact: "0123456783", role: "Customer", status: "Enabled" }
  ],
  homestays: defaultHomestays,
  bookings: [
    { id: "HB-1001", userId: "customer-1", homestayId: "stay-1", customerName: "Sarah Lim", customerEmail: "sarah@demo.test", customerContact: "0123456783", checkInDate: "2026-11-10", checkOutDate: "2026-11-13", numberOfGuests: 2, nightlyRate: 320, totalAmount: 960, status: "Confirmed" }
  ],
  currentUser: null
};

let heroSlideshowTimer = null;

// ==========================================================================
// 2. DATABASE SYNC & SESSION MANAGEMENT
// ==========================================================================

// Fetch latest records from MySQL via api.php
async function syncDatabase() {
  try {
    const res = await fetch("api.php?action=get_all");
    if (!res.ok) return;
    const data = await res.json();
    if (data.status === "success") {
      if (data.homestays && data.homestays.length > 0) appState.homestays = data.homestays;
      if (data.users && data.users.length > 0) appState.users = data.users;
      if (data.bookings) appState.bookings = data.bookings;
      route();
    }
  } catch (err) {
    console.warn("Notice: Running in preview mode:", err);
  }
}

// Restore saved user session from localStorage
function restoreSession() {
  const saved = localStorage.getItem("ruang_user");
  if (saved) {
    try {
      appState.currentUser = JSON.parse(saved);
    } catch {
      localStorage.removeItem("ruang_user");
    }
  }
  // Default to Sarah Lim (Customer) if no user logged in
  if (!appState.currentUser) {
    appState.currentUser = appState.users.find(u => u.role === "Customer") || appState.users[0];
  }
}

// Toast notification popup
function toast(msg) {
  const el = document.querySelector("#toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("visible");
  setTimeout(() => el.classList.remove("visible"), 3500);
}

// ==========================================================================
// 3. UI COMPONENTS & SHARED TEMPLATES
// ==========================================================================

// Homestay Card HTML generator
function stayCard(h) {
  return `
    <article class="stay-card">
      <a class="stay-photo" href="#details?id=${encodeURIComponent(h.id)}">
        <img src="${e(h.images[0])}" alt="${e(h.name)}">
        <span class="photo-label">${e(h.type || "Homestay")}</span>
      </a>
      <div style="font-size: 12px; margin-top: 10px; color: var(--muted);">${e(h.location)}, Malaysia</div>
      <h3><a href="#details?id=${encodeURIComponent(h.id)}">${e(h.name)}</a></h3>
      <p style="font-size: 12px;">Up to ${h.capacity} guests · ${e(h.facilities.slice(0, 2).join(" · "))}</p>
      <div class="stay-bottom">
        <span class="daily-rate" data-daily-rate="${e(h.pricePerNight)}">${dailyRateMarkup(h.pricePerNight)}</span>
        <a class="button secondary" style="min-height: 32px; padding: 4px 12px; font-size: 12px;" href="#details?id=${encodeURIComponent(h.id)}">View stay</a>
      </div>
    </article>
  `;
}

// Shared Booking Table HTML generator with Role-based Actions
function renderBookingTable(list) {
  if (!list.length) return "<p style='padding: 20px; background: var(--soft); border-radius: 8px;'>No bookings recorded yet.</p>";

  const u = appState.currentUser;
  const isOwnerOrAdmin = u && (u.role === "Admin" || u.role === "Owner");

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Booking Reference</th>
            <th>Customer Information</th>
            <th>Homestay & Place</th>
            <th>Dates</th>
            <th>Total Amount</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${list.map(b => {
            const stay = appState.homestays.find(h => h.id === b.homestayId);
            let actionButtons = "";

            if (isOwnerOrAdmin) {
              // Admin & Owner: Status transition (Confirm / Complete) + Permanent Delete Button
              const nextStatus = b.status === "Pending" ? "Confirmed" : "Completed";
              actionButtons = `
                <div style="display: flex; gap: 6px; align-items: center;">
                  ${b.status !== "Completed" && b.status !== "Cancelled" ? `
                    <button class="small-button" onclick="updateBooking('${e(b.id)}', '${nextStatus}')">
                      ${b.status === "Pending" ? "Confirm" : "Complete"}
                    </button>
                  ` : ""}
                  <button class="small-button" style="color: var(--danger); border-color: #fca5a5;" onclick="deleteBooking('${e(b.id)}')">
                    Delete
                  </button>
                </div>
              `;
            } else {
              // Customer: Cancel Button for Pending or Confirmed bookings
              if (b.status === "Cancelled") {
                actionButtons = `<small style="color: var(--muted);">Cancelled</small>`;
              } else if (b.status === "Completed") {
                actionButtons = `<small style="color: var(--muted);">Completed</small>`;
              } else {
                actionButtons = `
                  <button class="small-button" style="color: var(--danger); border-color: #fca5a5;" onclick="cancelBooking('${e(b.id)}')">
                    Cancel
                  </button>
                `;
              }
            }

            return `
              <tr>
                <td><strong>${e(b.id)}</strong></td>
                <td>
                  <strong>${e(b.customerName)}</strong>
                  <small style="display: block;">${e(b.customerEmail)}</small>
                  <small style="display: block; color: var(--primary);">${e(b.customerContact)}</small>
                </td>
                <td>
                  <strong>${e(stay ? stay.name : b.homestayId)}</strong>
                  <small style="display: block; color: var(--muted);">📍 ${e(stay ? stay.location : 'Malaysia')}</small>
                </td>
                <td>${e(b.checkInDate)} to ${e(b.checkOutDate)}<br><small>${b.numberOfGuests} guests</small></td>
                <td><strong>${money(b.totalAmount)}</strong></td>
                <td>${badge(b.status)}</td>
                <td>${actionButtons}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

// Action: Customer cancels their own booking
window.cancelBooking = async function(id) {
  if (!confirm("Are you sure you want to cancel this booking?")) return;
  await updateBooking(id, "Cancelled");
};

// Action: Admin or Room Owner permanently deletes a booking from database
window.deleteBooking = async function(id) {
  if (!confirm("Are you sure you want to permanently delete this booking?")) return;

  try {
    const res = await fetch("api.php?action=delete_booking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });
    const result = await res.json();
    if (result.status === "success") {
      toast("Booking deleted from database.");
    }
  } catch {}

  // Remove from frontend state and refresh view
  appState.bookings = appState.bookings.filter(b => b.id !== id);
  route();
};

// Action: Update booking status in database (Pending -> Confirmed -> Completed)
window.updateBooking = async function(id, status) {
  try {
    await fetch("api.php?action=update_booking_status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status })
    });
  } catch {}
  const item = appState.bookings.find(b => b.id === id);
  if (item) item.status = status;
  toast(`Status changed to ${status}`);
  route();
};

// Updates static navigation bar based on user and current active route
function updateShell(page) {
  const u = appState.currentUser;
  const statusEl = document.querySelector("#session-status-text");
  if (statusEl) {
    statusEl.innerHTML = u ? `Active account: <strong>${e(u.name)}</strong> (${e(u.role)})` : `Welcome to Ruang.`;
  }

  // Active navigation link highlighting
  document.querySelectorAll("#main-nav a").forEach(a => a.classList.remove("active"));
  if (page === "home") document.querySelector("#nav-home")?.classList.add("active");
  if (page === "explore") document.querySelector("#nav-explore")?.classList.add("active");
  if (page === "bookings") document.querySelector("#nav-bookings")?.classList.add("active");
  if (page.startsWith("owner")) document.querySelector("#nav-owner")?.classList.add("active");
  if (page.startsWith("admin")) document.querySelector("#nav-admin")?.classList.add("active");

  // Show role-specific links
  const ownerNav = document.querySelector("#nav-owner");
  const adminNav = document.querySelector("#nav-admin");
  if (ownerNav) ownerNav.style.display = (u && u.role === "Owner") ? "inline" : "none";
  if (adminNav) adminNav.style.display = (u && u.role === "Admin") ? "inline" : "none";

  // Toggle user avatar vs login button
  const userArea = document.querySelector("#nav-user-area");
  const loginBtn = document.querySelector("#nav-login-btn");
  const avatar = document.querySelector("#user-avatar");

  if (u) {
    if (userArea) userArea.style.display = "flex";
    if (loginBtn) loginBtn.style.display = "none";
    if (avatar) avatar.textContent = u.name.charAt(0);
  } else {
    if (userArea) userArea.style.display = "none";
    if (loginBtn) loginBtn.style.display = "inline-flex";
  }
}

// ==========================================================================
// 4. VIEW CONTROLLERS
// ==========================================================================

// 1. HOME VIEW
function showHome() {
  document.querySelector("#home-stay-grid").innerHTML = appState.homestays.slice(0, 4).map(stayCard).join("");
  startHeroBannerSlideshow();
}

// Cycles through homestay images every 4 seconds
function startHeroBannerSlideshow() {
  if (heroSlideshowTimer) {
    clearInterval(heroSlideshowTimer);
    heroSlideshowTimer = null;
  }

  const heroImg = document.querySelector("#hero-carousel-img");
  if (!heroImg) return;

  const bannerImages = appState.homestays.filter(h => h.status === "Active").map(h => h.images[0]).filter(Boolean);
  if (bannerImages.length <= 1) return;

  let currentIndex = 0;
  heroSlideshowTimer = setInterval(() => {
    const imgEl = document.querySelector("#hero-carousel-img");
    if (!imgEl) return;
    currentIndex = (currentIndex + 1) % bannerImages.length;
    imgEl.style.opacity = "0.2";
    setTimeout(() => {
      const activeEl = document.querySelector("#hero-carousel-img");
      if (activeEl) {
        activeEl.src = bannerImages[currentIndex];
        activeEl.style.opacity = "1";
      }
    }, 350);
  }, 4000);
}

// 2. EXPLORE VIEW
function showExplore(params) {
  const loc = params.get("location") || "";
  const select = document.querySelector("#explore-filter-select");
  if (select) {
    select.value = loc;
    select.onchange = () => { location.hash = "#explore?location=" + select.value; };
  }

  const stays = appState.homestays.filter(h => (!loc || h.location.toLowerCase().includes(loc.toLowerCase())) && h.status === "Active");
  document.querySelector("#explore-count").textContent = `${stays.length} homestays`;
  document.querySelector("#explore-stay-grid").innerHTML = stays.map(stayCard).join("");
}

// 3. DETAILS & REAL-TIME BOOKING VIEW
function showDetails(params) {
  const h = appState.homestays.find(item => item.id === params.get("id"));
  if (!h) {
    alert("Homestay not found.");
    location.hash = "#home";
    return;
  }
  const u = appState.currentUser;
  const images = (h.images && h.images.length > 0) ? h.images : ["images/PalmHouse.jpg"];

  // Populate textual info
  document.querySelector("#detail-title").textContent = h.name;
  document.querySelector("#detail-meta").textContent = `${h.location}, Malaysia · Up to ${h.capacity} guests`;
  document.querySelector("#detail-desc").textContent = h.description;
  document.querySelector("#detail-facilities").textContent = h.facilities.map(f => `✓ ${f}`).join("  ·  ");
  document.querySelector("#book-homestay-id").value = h.id;

  // Set initial main image
  const mainPhoto = document.querySelector("#main-photo");
  mainPhoto.src = images[0];

  // Render clickable thumbnails
  const thumbsContainer = document.querySelector("#detail-thumbnails");
  thumbsContainer.innerHTML = images.map((imgSrc, idx) => `
    <button type="button" class="gallery-thumb-btn" data-img="${e(imgSrc)}" style="border: 3px solid ${idx === 0 ? 'var(--primary)' : 'transparent'}; padding: 0; border-radius: 8px; overflow: hidden; width: 110px; height: 75px; flex-shrink: 0; cursor: pointer; opacity: ${idx === 0 ? '1' : '0.65'}; transition: all 0.2s ease;">
      <img src="${e(imgSrc)}" alt="${e(h.name)} preview" style="width: 100%; height: 100%; object-fit: cover; display: block;">
    </button>
  `).join("");

  // Thumbnail click handler: swaps image and updates border
  thumbsContainer.querySelectorAll(".gallery-thumb-btn").forEach(btn => {
    btn.onclick = () => {
      mainPhoto.style.opacity = "0.2";
      setTimeout(() => {
        mainPhoto.src = btn.dataset.img;
        mainPhoto.style.opacity = "1";
      }, 150);
      thumbsContainer.querySelectorAll(".gallery-thumb-btn").forEach(b => {
        const isCurrent = (b === btn);
        b.style.borderColor = isCurrent ? "var(--primary)" : "transparent";
        b.style.opacity = isCurrent ? "1" : "0.65";
      });
    };
  });

  // Date and live calculation setup
  const cin = document.querySelector("#cin");
  const cout = document.querySelector("#cout");
  const guests = document.querySelector("#book-guests");
  guests.max = h.capacity;

  document.querySelector("#book-cust-name").value = u?.name || "";
  document.querySelector("#book-cust-email").value = u?.email || "";
  document.querySelector("#book-cust-contact").value = u?.contact || "";

  cin.min = today();
  cin.value = selectedPricingDate && selectedPricingDate >= today() ? selectedPricingDate : today();
  const tom = new Date(`${cin.value}T00:00:00Z`);
  tom.setUTCDate(tom.getUTCDate() + 1);
  cout.min = cin.value;
  cout.value = tom.toISOString().slice(0, 10);

  function calcTotal() {
    const checkIn = new Date(`${cin.value}T00:00:00Z`);
    if (Number.isFinite(checkIn.getTime())) {
      const nextDay = new Date(checkIn);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      const firstNight = bookingPrice(cin.value, nextDay.toISOString().slice(0, 10), h.pricePerNight);
      document.querySelector("#detail-price-text").textContent = money(firstNight.total);
      document.querySelector("#detail-rate-note").textContent = firstNight.weekendNights
        ? "Weekend +10% included · 3+ nights: 5% off total"
        : "Sat–Sun: +10% · 3+ nights: 5% off total";
    } else {
      document.querySelector("#detail-price-text").textContent = "--";
      document.querySelector("#detail-rate-note").textContent = "Select a check-in date to see its nightly rate.";
    }
    const price = bookingPrice(cin.value, cout.value, h.pricePerNight);
    cout.setCustomValidity(price ? "" : "Check-out must be after check-in.");
    document.querySelector("#live-total").textContent = price ? money(price.total) : "--";
    document.querySelector("#live-price-details").textContent = price
      ? `${price.nightCount} night(s) · Weekend surcharge (${price.weekendNights} night(s)): ${money(price.surcharge)} · 3+ nights discount (5%): −${money(price.discount)}`
      : "Select a check-out date after check-in.";
  }
  cin.onchange = () => { cout.min = cin.value; calcTotal(); };
  cout.onchange = calcTotal;
  calcTotal();

  // Handle booking form submission
  document.querySelector("#book-form").onsubmit = async (ev) => {
    ev.preventDefault();
    const price = bookingPrice(cin.value, cout.value, h.pricePerNight);
    if (!price) { calcTotal(); cout.reportValidity(); return; }
    const newBooking = {
      homestayId: h.id,
      userId: u ? u.id : "customer-1",
      customerName: document.querySelector("#book-cust-name").value,
      customerEmail: document.querySelector("#book-cust-email").value,
      customerContact: document.querySelector("#book-cust-contact").value,
      checkInDate: cin.value,
      checkOutDate: cout.value,
      numberOfGuests: parseInt(guests.value),
      nightlyRate: h.pricePerNight,
      totalAmount: price.total
    };

    try {
      const res = await fetch("api.php?action=create_booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newBooking)
      });
      const result = await res.json();
      if (result.status === "success") {
        toast("Booking saved in MySQL database!");
        await syncDatabase();
        location.hash = "#bookings";
        return;
      }
      toast(result.message || "Unable to save booking.");
    } catch {
      newBooking.id = "HB-" + Math.floor(1000 + Math.random() * 9000);
      newBooking.status = "Pending";
      appState.bookings.unshift(newBooking);
      toast("Booking recorded!");
      location.hash = "#bookings";
    }
  };
}

// 4. CUSTOMER BOOKINGS VIEW
function showCustomerBookings() {
  const u = appState.currentUser;
  document.querySelector("#bookings-subtitle").textContent = `Reservations made under ${e(u?.email || 'Guest')}`;
  const list = appState.bookings.filter(b => b.userId === u?.id || b.customerEmail === u?.email);
  document.querySelector("#customer-bookings-container").innerHTML = renderBookingTable(list);
}

// 5. MANAGER / ROOM OWNER WORKSPACE
function showOwner(subtab) {
  const u = appState.currentUser;
  if (!u || u.role !== "Owner") {
    alert("Please switch to a Room Owner account.");
    location.hash = "#login";
    return;
  }

  document.querySelector("#owner-welcome").textContent = `Welcome, ${u.name}`;
  const myStays = appState.homestays.filter(h => h.ownerId === u.id);
  const myStayIds = myStays.map(h => h.id);
  const myBookings = appState.bookings.filter(b => myStayIds.includes(b.homestayId));

  document.querySelector("#owner-stat-properties").textContent = myStays.length;
  document.querySelector("#owner-stat-bookings").textContent = myBookings.length;
  document.querySelector("#owner-stat-revenue").textContent = money(myBookings.reduce((sum, b) => sum + b.totalAmount, 0));

  const isBookings = (subtab === "bookings");
  document.querySelector("#owner-side-overview").classList.toggle("active", subtab === "overview");
  document.querySelector("#owner-side-stays").classList.toggle("active", subtab === "homestays");
  document.querySelector("#owner-side-bookings").classList.toggle("active", isBookings);

  document.querySelector("#owner-section-stays").style.display = isBookings ? "none" : "block";
  document.querySelector("#owner-section-bookings").style.display = isBookings ? "block" : "none";

  if (isBookings) {
    document.querySelector("#owner-bookings-container").innerHTML = renderBookingTable(myBookings);
  } else {
    document.querySelector("#owner-stays-grid").innerHTML = myStays.map(h => `
      <div style="border: 1px solid var(--line); border-radius: 10px; overflow: hidden; background: white; display: flex; flex-direction: column;">
        <img src="${e(h.images[0])}" style="height: 170px; object-fit: cover;" alt="${e(h.name)}">
        <div style="padding: 18px; flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <strong style="font-size: 16px;">${e(h.name)}</strong>
              ${badge(h.status)}
            </div>
            <p style="font-size: 12px; margin-bottom: 8px;">📍 ${e(h.location)} · Up to ${h.capacity} guests</p>
            <p style="font-size: 12px; color: var(--muted); line-height: 1.4; margin-bottom: 12px;">${e(h.description.slice(0, 95))}...</p>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--line); padding-top: 12px; margin-top: 10px;">
            <div><strong style="font-size: 16px; color: var(--primary);">${money(h.pricePerNight)}</strong> <small>/ night</small></div>
            <button class="button" style="min-height: 34px; padding: 6px 14px; font-size: 12px;" onclick="openEditHomestayModal('${e(h.id)}')">✏️ Edit Details</button>
          </div>
        </div>
      </div>
    `).join("");
  }
}

// Room Owner edit homestay modal logic
window.openEditHomestayModal = function(stayId) {
  const h = appState.homestays.find(item => item.id === stayId);
  const u = appState.currentUser;
  if (!h || !u || h.ownerId !== u.id) {
    toast("Unauthorized action.");
    return;
  }

  document.querySelector("#edit-stay-id").value = h.id;
  document.querySelector("#edit-stay-owner").value = u.id;
  document.querySelector("#edit-stay-name").value = h.name;
  document.querySelector("#edit-stay-location").value = h.location;
  document.querySelector("#edit-stay-type").value = h.type || "Homestay";
  document.querySelector("#edit-stay-price").value = h.pricePerNight;
  document.querySelector("#edit-stay-capacity").value = h.capacity;
  document.querySelector("#edit-stay-status").value = h.status;
  document.querySelector("#edit-stay-facilities").value = h.facilities.join(", ");
  document.querySelector("#edit-stay-images").value = h.images.join("\n");
  document.querySelector("#edit-stay-desc").value = h.description;

  const dialog = document.querySelector("#dialog");
  dialog.showModal();

  document.querySelector("#editHomestayForm").onsubmit = async (ev) => {
    ev.preventDefault();
    const payload = {
      id: document.querySelector("#edit-stay-id").value,
      ownerId: document.querySelector("#edit-stay-owner").value,
      name: document.querySelector("#edit-stay-name").value,
      location: document.querySelector("#edit-stay-location").value,
      type: document.querySelector("#edit-stay-type").value,
      pricePerNight: parseFloat(document.querySelector("#edit-stay-price").value),
      capacity: parseInt(document.querySelector("#edit-stay-capacity").value),
      status: document.querySelector("#edit-stay-status").value,
      facilities: document.querySelector("#edit-stay-facilities").value,
      images: document.querySelector("#edit-stay-images").value,
      description: document.querySelector("#edit-stay-desc").value
    };

    try {
      const res = await fetch("api.php?action=update_homestay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (result.status === "success") {
        toast("Homestay details updated in MySQL!");
        dialog.close();
        await syncDatabase();
        route();
        return;
      }
    } catch {
      const idx = appState.homestays.findIndex(item => item.id === payload.id);
      if (idx !== -1) {
        appState.homestays[idx] = {
          ...appState.homestays[idx],
          name: payload.name,
          location: payload.location,
          type: payload.type,
          pricePerNight: payload.pricePerNight,
          capacity: payload.capacity,
          status: payload.status,
          facilities: payload.facilities.split(",").map(s => s.trim()),
          images: payload.images.split("\n").map(s => s.trim()).filter(Boolean),
          description: payload.description
        };
      }
      toast("Homestay details updated!");
      dialog.close();
      route();
    }
  };
};

// 6. ADMIN WORKSPACE & ANALYTICS
function showAdmin(subtab) {
  const u = appState.currentUser;
  if (!u || u.role !== "Admin") {
    alert("Please switch to an Admin account.");
    location.hash = "#login";
    return;
  }

  document.querySelector("#admin-logged-name").textContent = u.name;
  const isAnalytics = (subtab === "analytics" || !subtab);
  const isBookings = (subtab === "bookings");
  const isUsers = (subtab === "users");

  document.querySelector("#admin-side-analytics").classList.toggle("active", isAnalytics);
  document.querySelector("#admin-side-bookings").classList.toggle("active", isBookings);
  document.querySelector("#admin-side-users").classList.toggle("active", isUsers);

  document.querySelector("#admin-section-analytics").style.display = isAnalytics ? "block" : "none";
  document.querySelector("#admin-section-bookings").style.display = isBookings ? "block" : "none";
  document.querySelector("#admin-section-users").style.display = isUsers ? "block" : "none";
  document.querySelector("#admin-report-actions").style.display = isAnalytics ? "flex" : "none";

  if (isAnalytics) {
    document.querySelector("#admin-page-title").textContent = "Location Analytics & Reports";
    const analytics = calculateLocationAnalytics();
    document.querySelector("#admin-stat-bookings").textContent = analytics.grandTotalBookings;
    document.querySelector("#admin-stat-revenue").textContent = money(analytics.grandTotalRevenue);
    document.querySelector("#admin-stat-toploc").textContent = analytics.locations[0]?.location || "None";

    document.querySelector("#admin-analytics-tbody").innerHTML = analytics.locations.map(loc => `
      <tr>
        <td><strong>📍 ${e(loc.location)}</strong></td>
        <td>${loc.homestayCount} stay(s)</td>
        <td><strong style="font-size: 14px; color: var(--primary);">${loc.totalBookings}</strong></td>
        <td><span class="badge confirmed">${loc.confirmedBookings} Confirmed</span></td>
        <td>
          <span class="badge pending">${loc.pendingBookings} Pending</span>
          ${loc.cancelledBookings > 0 ? `<span class="badge cancelled">${loc.cancelledBookings} Cancelled</span>` : ""}
        </td>
        <td>${loc.totalGuests} guests</td>
        <td><strong>${money(loc.totalRevenue)}</strong></td>
        <td>
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="flex: 1; background: var(--line); height: 7px; border-radius: 4px; overflow: hidden; min-width: 60px;">
              <div style="width: ${loc.bookingShare}%; background: var(--primary); height: 100%;"></div>
            </div>
            <small style="font-weight: 600;">${loc.bookingShare}%</small>
          </div>
        </td>
      </tr>
    `).join("");
  } else if (isBookings) {
    document.querySelector("#admin-page-title").textContent = "All Platform Reservations";
    document.querySelector("#admin-bookings-container").innerHTML = renderBookingTable(appState.bookings);
  } else if (isUsers) {
    document.querySelector("#admin-page-title").textContent = "All Registered Users";
    document.querySelector("#admin-users-tbody").innerHTML = appState.users.map(user => `
      <tr>
        <td><code>${e(user.id)}</code></td>
        <td><strong>${e(user.name)}</strong></td>
        <td>${e(user.email)}</td>
        <td>${e(user.contact)}</td>
        <td><span class="badge ${user.role === 'Admin' ? 'completed' : user.role === 'Owner' ? 'pending' : 'active'}">${e(user.role)}</span></td>
        <td>${badge(user.status)}</td>
      </tr>
    `).join("");
  }
}

// Calculate booking analytics by destination city
function calculateLocationAnalytics() {
  const locationMap = {};
  appState.homestays.forEach(h => {
    if (!locationMap[h.location]) {
      locationMap[h.location] = { location: h.location, homestayCount: 0, totalBookings: 0, confirmedBookings: 0, pendingBookings: 0, cancelledBookings: 0, totalGuests: 0, totalRevenue: 0 };
    }
    locationMap[h.location].homestayCount += 1;
  });

  appState.bookings.forEach(b => {
    const stay = appState.homestays.find(h => h.id === b.homestayId);
    const loc = stay?.location || "Other";
    if (!locationMap[loc]) {
      locationMap[loc] = { location: loc, homestayCount: 0, totalBookings: 0, confirmedBookings: 0, pendingBookings: 0, cancelledBookings: 0, totalGuests: 0, totalRevenue: 0 };
    }
    locationMap[loc].totalBookings += 1;
    locationMap[loc].totalGuests += Number(b.numberOfGuests) || 0;
    const amount = Number(b.totalAmount) || 0;
    if (b.status === "Confirmed" || b.status === "Completed") {
      locationMap[loc].confirmedBookings += 1;
      locationMap[loc].totalRevenue += amount;
    } else if (b.status === "Cancelled") {
      locationMap[loc].cancelledBookings += 1;
    } else {
      locationMap[loc].pendingBookings += 1;
      locationMap[loc].totalRevenue += amount;
    }
  });

  const locations = Object.values(locationMap);
  const grandTotalBookings = locations.reduce((sum, l) => sum + l.totalBookings, 0);
  const grandTotalRevenue = locations.reduce((sum, l) => sum + l.totalRevenue, 0);
  locations.forEach(l => {
    l.bookingShare = grandTotalBookings > 0 ? ((l.totalBookings / grandTotalBookings) * 100).toFixed(1) : 0;
    l.revenueShare = grandTotalRevenue > 0 ? ((l.totalRevenue / grandTotalRevenue) * 100).toFixed(1) : 0;
  });
  locations.sort((a, b) => b.totalBookings - a.totalBookings);

  return { locations, grandTotalBookings, grandTotalRevenue, totalGuests: locations.reduce((sum, l) => sum + l.totalGuests, 0) };
}

// Download report as CSV spreadsheet
window.downloadLocationReportCSV = function() {
  const data = calculateLocationAnalytics();
  const rows = [
    ["RUANG HOMESTAY - LOCATION BOOKINGS AND REVENUE REPORT"],
    ["Generated on: " + new Date().toLocaleString("en-MY")],
    [],
    ["Destination (Place)", "Homestays Count", "Total Bookings", "Confirmed", "Pending", "Cancelled", "Total Guests", "Revenue (RM)", "Booking Share (%)", "Revenue Share (%)"]
  ];
  data.locations.forEach(l => {
    rows.push([`"${l.location}"`, l.homestayCount, l.totalBookings, l.confirmedBookings, l.pendingBookings, l.cancelledBookings, l.totalGuests, l.totalRevenue.toFixed(2), `${l.bookingShare}%`, `${l.revenueShare}%`]);
  });
  rows.push([]);
  rows.push(["TOTAL", appState.homestays.length, data.grandTotalBookings, "-", "-", "-", data.totalGuests, data.grandTotalRevenue.toFixed(2), "100%", "100%"]);

  const link = document.createElement("a");
  link.setAttribute("href", encodeURI("data:text/csv;charset=utf-8," + rows.map(r => r.join(",")).join("\n")));
  link.setAttribute("download", `ruang_location_report_${today()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  toast("CSV report downloaded successfully.");
};

// Print / PDF Report trigger
window.printLocationReport = function() {
  window.print();
};

// 7. LOGIN VIEW
function showLogin() {
  document.querySelector("#login-accounts-list").innerHTML = appState.users.map(u => `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border: 1px solid var(--line); border-radius: 6px;">
      <div>
        <strong>${e(u.name)}</strong>
        <span class="badge ${u.role === 'Admin' ? 'completed' : u.role === 'Owner' ? 'pending' : 'active'}">${e(u.role)}</span>
        <small style="display: block;">${e(u.email)}</small>
      </div>
      <button class="button secondary" style="min-height: 32px; padding: 4px 14px;" onclick="loginAs('${e(u.id)}')">Switch</button>
    </div>
  `).join("");
}

// Switch current active user
window.loginAs = function(id) {
  const user = appState.users.find(u => u.id === id);
  if (user) {
    appState.currentUser = user;
    localStorage.setItem("ruang_user", JSON.stringify(user));
    toast(`Switched to ${user.name}`);
    if (user.role === "Admin") location.hash = "#admin";
    else if (user.role === "Owner") location.hash = "#owner";
    else location.hash = "#home";
  }
};

// Log out active user
window.logout = function() {
  localStorage.removeItem("ruang_user");
  appState.currentUser = null;
  toast("Logged out.");
  location.hash = "#home";
  route();
};

// ==========================================================================
// 5. ROUTER & STARTUP BOOTLOADER
// ==========================================================================

// Single-page router: controls which section in index.html is visible
function route() {
  if (heroSlideshowTimer) {
    clearInterval(heroSlideshowTimer);
    heroSlideshowTimer = null;
  }

  const hash = location.hash.replace(/^#/, "") || "home";
  const [page, queryString] = hash.split("?");
  const params = new URLSearchParams(queryString || "");

  updateShell(page);

  // Hide all sections first
  document.querySelectorAll(".page-view").forEach(v => { v.hidden = true; });

  // Show the matching section
  if (page === "home") {
    document.querySelector("#view-home").hidden = false;
    showHome();
  } else if (page === "explore") {
    document.querySelector("#view-explore").hidden = false;
    showExplore(params);
  } else if (page === "details") {
    document.querySelector("#view-details").hidden = false;
    showDetails(params);
  } else if (page === "bookings") {
    document.querySelector("#view-bookings").hidden = false;
    showCustomerBookings();
  } else if (page.startsWith("owner")) {
    document.querySelector("#view-owner").hidden = false;
    showOwner(page === "owner-bookings" ? "bookings" : page === "owner-homestays" ? "homestays" : "overview");
  } else if (page.startsWith("admin")) {
    document.querySelector("#view-admin").hidden = false;
    showAdmin(page === "admin-bookings" ? "bookings" : page === "admin-users" ? "users" : "analytics");
  } else if (page === "login") {
    document.querySelector("#view-login").hidden = false;
    showLogin();
  } else {
    document.querySelector("#view-home").hidden = false;
    showHome();
  }
}

// App startup
function start() {
  restoreSession();
  setupDatePriceSearch();
  route();
  syncDatabase();
  // Refresh prices across midnight, including when a suspended tab is reopened.
  setInterval(refreshDisplayedRates, 30000);
  window.addEventListener("focus", refreshDisplayedRates);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshDisplayedRates();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start);
} else {
  start();
}

window.addEventListener("hashchange", route);
