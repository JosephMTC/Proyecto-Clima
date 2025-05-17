const apiKey = '41a6b4850398597c4ed2849cedd43510';

// ————— DOM elements —————
const unitSelect     = document.getElementById('unitSelect');
const cityInput      = document.getElementById('cityInput');
const addCityBtn     = document.getElementById('addCityBtn');
const stateSelect    = document.getElementById('stateSelect');
const addBtn         = document.getElementById('addBtn');
const themeToggle    = document.getElementById('themeToggle');
const cardsContainer = document.getElementById('cardsContainer');

// ————— Initial settings —————
// Theme
const savedTheme = localStorage.getItem('theme') || 'light';
document.body.classList.toggle('dark-mode', savedTheme === 'dark');
themeToggle.checked = savedTheme === 'dark';

// Unit
const savedUnit = localStorage.getItem('unit') || 'metric';
unitSelect.value = savedUnit;

// ————— Event listeners —————
// Theme toggle (click + keyboard)
themeToggle.addEventListener('change', () => {
  const theme = themeToggle.checked ? 'dark' : 'light';
  document.body.classList.toggle('dark-mode', theme === 'dark');
  localStorage.setItem('theme', theme);
});
themeToggle.addEventListener('keydown', e => {
  if (['Enter',' '].includes(e.key)) {
    e.preventDefault();
    themeToggle.checked = !themeToggle.checked;
    themeToggle.dispatchEvent(new Event('change'));
  }
});

// Unit toggle
unitSelect.addEventListener('change', () => {
  localStorage.setItem('unit', unitSelect.value);
  window.location.reload();
});

// Search by state
addBtn.addEventListener('click', () => {
  const code = stateSelect.value;
  if (code) fetchWeather({ stateCode: code });
});

// Search by city (button + Enter)
addCityBtn.addEventListener('click', () => {
  const q = cityInput.value.trim();
  if (q) fetchWeather({ query: q });
});
cityInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    addCityBtn.click();
  }
});

// Keyboard navigation between cards
document.addEventListener('keydown', e => {
  const f = document.activeElement;
  if (!f.classList.contains('card')) return;
  const cards = Array.from(document.querySelectorAll('.card'));
  let idx = cards.indexOf(f);
  if (e.key === 'ArrowRight') { idx = (idx + 1) % cards.length; cards[idx].focus(); e.preventDefault(); }
  if (e.key === 'ArrowLeft')  { idx = (idx + cards.length - 1) % cards.length; cards[idx].focus(); e.preventDefault(); }
  if (e.key === 'Enter') {
    const id = f.id.replace('card-','');
    if (id !== 'local') fetchWeather({ stateCode: id });
    e.preventDefault();
  }
});

// ————— State-to-city map —————
const stateToCity = {
  CA: 'Los Angeles', NY: 'New York', TX: 'Houston',
  WA: 'Seattle',   UT: 'Salt Lake City', MN: 'Saint Paul',
  MI: 'Lansing',   FL: 'Tallahassee',    NM: 'Santa Fe',
  CO: 'Denver'
};

// ————— Helpers —————
function getWeatherSVG(main) {
  const map = { Clear:'01d', Clouds:'02d', Rain:'10d', Snow:'13d' };
  const code = map[main] || '02d';
  return `<img class="weather-icon" src="https://openweathermap.org/img/wn/${code}@2x.png" alt="${main}">`;
}
function formatTimeUTC(ts, tz) {
  return new Date((ts + tz) * 1000)
    .toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', hour12:true, timeZone:'UTC' });
}

// ————— Geolocation + initial fetch —————
if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(async pos => {
    const { latitude: lat, longitude: lon } = pos.coords;
    // Reverse geocoding to get city,country
    try {
      const geoUrl = `https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${apiKey}`;
      const geoRes = await fetch(geoUrl);
      if (!geoRes.ok) throw new Error();
      const [loc] = await geoRes.json();
      fetchWeather({ lat, lon, query:`${loc.name},${loc.country}` });
    } catch {
      fetchWeather({ lat, lon, stateCode:'local' });
    }
  }, console.error);
}

// ————— Main fetch & render —————
async function fetchWeather({ stateCode, lat, lon, query }) {
  const unit   = localStorage.getItem('unit') || 'metric';
  const symbol = unit==='metric'?'°C':'°F';
  const idKey  = stateCode||query;
  const cardId = `card-${idKey}`;
  if (document.getElementById(cardId)) return;

  // Loader card
  const loader = document.createElement('div');
  loader.id = cardId;
  loader.className = 'card loading';
  cardsContainer.appendChild(loader);

  try {
    let nameLabel = '';
    // Geocoding if needed
    if (stateCode || (query && query!=='local')) {
      const q = stateCode ? `${encodeURIComponent(stateToCity[stateCode])},US`
                          : encodeURIComponent(query);
      const geoRes = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${q}&limit=1&appid=${apiKey}`);
      if (!geoRes.ok) throw new Error('Ubicación no encontrada');
      const [loc] = await geoRes.json();
      lat = loc.lat; lon = loc.lon;
      const suf = stateCode?stateCode:loc.country;
      nameLabel = loc.name.includes(suf)?loc.name:`${loc.name}, ${suf}`;
    }

    // Current weather
    const wRes = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}`+
      `&units=${unit}&appid=${apiKey}`
    );
    if (!wRes.ok) throw new Error('No se pudo obtener el clima');
    const w = await wRes.json();

    // Update header mood video
    updateHeaderMood(w.weather[0].main, w.timezone);

    // UV index
    const uRes = await fetch(
      `https://api.openweathermap.org/data/2.5/uvi?lat=${lat}&lon=${lon}&appid=${apiKey}`
    );
    if (!uRes.ok) throw new Error('No se pudo obtener índice UV');
    const { value: uvi } = await uRes.json();

    loader.remove();
    renderCard(idKey, {
      name:       nameLabel||w.name,
      weather:    w.weather[0],
      main:       w.main,
      wind:       w.wind,
      sys:        w.sys,
      visibility: w.visibility,
      uvi, timezone:w.timezone,
      symbol, lat, lon
    });

  } catch (err) {
    loader.className = 'card error fade-out';
    loader.innerHTML = `<div>⚠️ ${err.message}</div>`;
    setTimeout(()=>loader.remove(),3000);
  }
}

// ————— Render single card —————
function renderCard(id, d) {
  const card = document.createElement('div');
  card.id = `card-${id}`;
  card.className = 'card';
  card.tabIndex = 0;
  card.setAttribute('aria-label', `Clima en ${d.name}`);

  card.innerHTML = `
    ${getWeatherSVG(d.weather.main)}
    <button class="close-btn" aria-label="Cerrar tarjeta">&times;</button>
    <h2>${d.name}</h2>
    <div class="temp">${Math.round(d.main.temp)}${d.symbol}</div>
    <div class="details">
      <div>Clima: ${d.weather.description}</div>
      <div>Humedad: ${d.main.humidity}%</div>
      <div>Viento: ${Math.round(d.wind.speed)} ${d.symbol==='°C'?'m/s':'mph'}</div>
    </div>
    <div class="extra-details">
      <div>Amanecer: ${formatTimeUTC(d.sys.sunrise,d.timezone)}</div>
      <div>Atardecer: ${formatTimeUTC(d.sys.sunset, d.timezone)}</div>
      <div>Índice UV: ${d.uvi}</div>
      <div>Visibilidad: ${Math.round(d.visibility/1000)} km</div>
      <div>Presión: ${d.main.pressure} hPa</div>
    </div>
    <canvas id="chart-${id}" class="forecast-chart"></canvas>
  `;

  card.querySelector('.close-btn').onclick = () => card.remove();
  cardsContainer.appendChild(card);
  renderForecastChart(d.lat,d.lon,id,d.symbol);
}

// ————— 5-day forecast chart —————
async function renderForecastChart(lat, lon, id, symbol) {
  try {
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}`+
      `&units=${localStorage.getItem('unit')}&appid=${apiKey}`
    );
    if (!res.ok) throw new Error();
    const js = await res.json();
    const daily = js.list.filter(x=>x.dt_txt.includes('12:00:00')).slice(0,5);
    const labels = daily.map(x=>new Date(x.dt*1000).toLocaleDateString(undefined,{weekday:'short'}));
    const mins   = daily.map(x=>x.main.temp_min);
    const maxs   = daily.map(x=>x.main.temp_max);

    const ctx = document.getElementById(`chart-${id}`).getContext('2d');
    new Chart(ctx, {
      type:'line',
      data:{ labels, datasets:[
        { label:`Mín (${symbol})`, data:mins, borderColor:'#3498db', backgroundColor:'transparent', tension:0.3 },
        { label:`Máx (${symbol})`, data:maxs, borderColor:'#e74c3c', backgroundColor:'transparent', tension:0.3 }
      ]},
      options:{
        responsive:true,
        plugins:{ legend:{ labels:{ color:getComputedStyle(document.body).color } } },
        scales:{ x:{ ticks:{ color:getComputedStyle(document.body).color }},
                 y:{ ticks:{ color:getComputedStyle(document.body).color }}}
      }
    });

  } catch{}
}

// ————— Header mood (video + classes) —————
function updateHeaderMood(weatherMain, timezone) {
  const header = document.querySelector('.header-container');
  const video  = header.querySelector('.bg-video');
  if (!video) return;

  // Clear old classes
  header.classList.remove('day','night','clear','rain');

  // Local hour
  const hour = new Date(Date.now()+timezone*1000).getUTCHours();
  const timeClass = (hour>=6 && hour<18)?'day':'night';
  header.classList.add(timeClass);

  const wc = weatherMain.toLowerCase()==='rain'?'rain':'clear';
  header.classList.add(wc);

  const path = `videos/${wc}-${timeClass}.mp4`;
  video.classList.remove('visible');
  video.pause(); video.currentTime = 0;
  fetch(path,{method:'HEAD'})
    .then(r=>{ if(r.ok){
      video.src=path; video.load(); video.play().catch(()=>{});
      video.onloadeddata = ()=> video.classList.add('visible');
    }}).catch(()=>{});
}





