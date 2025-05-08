const apiKey = '41a6b4850398597c4ed2849cedd43510';

// ————— Unidad de temperatura —————
const unitSelect = document.getElementById('unitSelect');
const savedUnit  = localStorage.getItem('unit') || 'metric';
unitSelect.value = savedUnit;
unitSelect.addEventListener('change', () => {
  localStorage.setItem('unit', unitSelect.value);
  window.location.reload();
});
const cityInput = document.getElementById('cityInput');
const addCityBtn = document.getElementById('addCityBtn');

addCityBtn.addEventListener('click', () => {
  const query = cityInput.value.trim();
  if (!query) return;
  fetchWeatherByCity(query);
});

cityInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    addCityBtn.click(); // Simula el click al botón
  }
});

const stateSelect   = document.getElementById('stateSelect');
const addBtn        = document.getElementById('addBtn');
const cardsContainer= document.getElementById('cardsContainer');
const themeToggle   = document.getElementById('themeToggle');

// ————— Theme toggle —————
const savedTheme = localStorage.getItem('theme') || 'light';
document.body.classList.toggle('dark-mode', savedTheme === 'dark');
themeToggle.checked = savedTheme === 'dark';
themeToggle.addEventListener('change', () => {
  const theme = themeToggle.checked ? 'dark' : 'light';
  document.body.classList.toggle('dark-mode', theme === 'dark');
  localStorage.setItem('theme', theme);
});
themeToggle.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    themeToggle.checked = !themeToggle.checked;
    themeToggle.dispatchEvent(new Event('change'));
  }
});


const stateToCity = {
  CA: 'Los Angeles', 
  NY: 'New York', 
  TX: 'Houston',
  WA: 'Seattle', 
  UT: 'Salt Lake City', 
  MN: 'Saint Paul',
  MI: 'Lansing', 
  FL: 'Tallahassee', 
  NM: 'Santa Fe',
  CO: 'Denver',
};

function getWeatherSVG(main) {
  const code = {
    Clear: '01d',
    Clouds: '02d',
    Rain: '10d',
    Snow: '13d'
  }[main] || '02d';
  return `<img class="weather-icon" src="https://openweathermap.org/img/wn/${code}@2x.png" alt="${main}">`;
}

function formatTime(ts, timezone) {
  const utcMs = ts * 1000 + timezone * 1000;
  return new Date(utcMs).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC'
  });
}

// Click manual
addBtn.addEventListener('click', () => {
  const code = stateSelect.value;
  if (!code) return;
  fetchWeatherByState(code);
});

// Geolocalización al cargar
document.addEventListener('DOMContentLoaded', () => {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos => {
      fetchWeatherByCoords(pos.coords.latitude, pos.coords.longitude, 'local');
    });
  }
});

async function fetchWeatherByState(stateCode) {
  const city = stateToCity[stateCode];
  await fetchWeatherCore({ city, stateCode });
}

async function fetchWeatherByCoords(lat, lon, stateCode) {
  await fetchWeatherCore({ lat, lon, stateCode });
}

/**
 * Obtiene datos de clima (estados o ciudades) y crea tarjeta + header dinámico
 * @param {{city?: string, stateCode?: string, lat?: number, lon?: number, query?: string}} opts
 */

async function fetchWeatherCore({ city, stateCode, lat, lon, query }) {
  const unit   = localStorage.getItem('unit') || 'metric';
  const symbol = unit === 'metric' ? '°C' : '°F';
  // Identificador único: usa stateCode o query (ciudad internacional)
  const idKey  = stateCode || query;
  const tempId = `card-${idKey}`;
  if (document.getElementById(tempId)) return;

  // 1) Muestra loader
  const loadingCard = document.createElement('div');
  loadingCard.className = 'card loading';
  loadingCard.id = tempId;
  cardsContainer.appendChild(loadingCard);

  try {
    let nameLabel = '';
    // 2) Si viene city (estados) o query (ciudades), hacemos geocoding
    if (city || query) {
      const q = city
        ? `${encodeURIComponent(city)},US`
        : encodeURIComponent(query);
      const geoRes = await fetch(
        `https://api.openweathermap.org/geo/1.0/direct?q=${q}&limit=1&appid=${apiKey}`
      );
      if (!geoRes.ok) throw new Error('Ubicación no encontrada');
      const [loc] = await geoRes.json();
      if (!loc) throw new Error('Ubicación no encontrada');
      lat = loc.lat; lon = loc.lon;
      // Etiqueta: "Nombre, Estado" o "Nombre, País"
      nameLabel = city
        ? `${loc.name}, ${stateCode}`
        : `${loc.name}, ${loc.country}`;
    }

    // 3) Petición clima actual
    const wRes = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}` +
      `&units=${unit}&appid=${apiKey}`
    );
    if (!wRes.ok) throw new Error('Error al obtener clima');
    const w = await wRes.json();

    // 4) Actualiza header mood usando la hora LOCAL de la ubicación
    updateHeaderMood(w.weather[0].main, w.timezone);

    // 5) Petición UV
    const uviRes = await fetch(
      `https://api.openweathermap.org/data/2.5/uvi?lat=${lat}&lon=${lon}&appid=${apiKey}`
    );
    if (!uviRes.ok) throw new Error('Error al obtener UV index');
    const { value: uvi } = await uviRes.json();

    // 6) Crear tarjeta
// … tras obtener w y uvi …

loadingCard.remove();
createCard(idKey, {
  name:       nameLabel || w.name,
  main:       w.main,
  weather:    w.weather,
  visibility: w.visibility,
  sys:        w.sys,
  wind:       { speed: w.wind.speed },
  uvi,
  lat, lon,
  symbol,
  timezone:   w.timezone   // ← Muy importante
});


  } catch (err) {
    // Manejo de error
    loadingCard.className = 'card error fade-out';
    loadingCard.innerHTML = `<div>⚠️ ${err.message}</div>`;
    setTimeout(() => loadingCard.remove(), 3000);
  }
}


function createCard(stateCode, data) {
  const card = document.createElement('div');
  card.className = 'card';
  card.id = `card-${stateCode}`;
  card.tabIndex = 0;
  card.setAttribute('aria-label',
    `Tarjeta de clima de ${data.name}${stateCode==='local'?' (Local)':`, ${stateCode}`}`
  );

  // formatea hora usando UTC para que respete sólo el offset que le damos
  function formatTime(ts, timezone) {
    // ms UTC ajustado por timezone
    const utcMs = ts * 1000 + timezone * 1000;
    const date = new Date(utcMs);
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'UTC'     // ⚠️ clave para no aplicar tu zona local
    });
  }

  card.innerHTML = `
    ${getWeatherSVG(data.weather[0].main)}
    <button class="close-btn">&times;</button>
    <h2>${data.name}${stateCode==='local'?' (Local)':`, ${stateCode}`}</h2>
    <div class="temp">${Math.round(data.main.temp)}${data.symbol}</div>
    <div class="details">
      <div>Clima: ${data.weather[0].description}</div>
      <div>Humedad: ${data.main.humidity}%</div>
      <div>Viento: ${Math.round(data.wind.speed)} ${data.symbol==='°C'?'m/s':'mph'}</div>
    </div>
    <div class="extra-details">
      <div>Amanecer: ${formatTime(data.sys.sunrise, data.timezone)}</div>
      <div>Atardecer: ${formatTime(data.sys.sunset,  data.timezone)}</div>
      <div>Índice UV: ${data.uvi}</div>
      <div>Visibilidad: ${Math.round(data.visibility/1000)} km</div>
      <div>Presión: ${data.main.pressure} hPa</div>
    </div>
    <canvas id="chart-${stateCode}" class="forecast-chart"></canvas>
  `;

  card.querySelector('.close-btn').onclick = () => {
    card.classList.add('fade-out');
    card.addEventListener('animationend', () => card.remove());
  };

  cardsContainer.appendChild(card);
  renderForecastChart(data.lat, data.lon, stateCode, data.symbol);
}


async function renderForecastChart(lat, lon, stateCode, symbol) {
  try {
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}` +
      `&units=${localStorage.getItem('unit')}&appid=${apiKey}`
    );
    if (!res.ok) throw new Error('Pronóstico extendido fallido');
    const js = await res.json();
    const daily = js.list.filter(d => d.dt_txt.includes('12:00:00')).slice(0,5);
    const labels = daily.map(d => new Date(d.dt*1000)
      .toLocaleDateString(undefined,{weekday:'short'}));
    const mins = daily.map(d => d.main.temp_min);
    const maxs = daily.map(d => d.main.temp_max);
    const ctx  = document.getElementById(`chart-${stateCode}`).getContext('2d');

    new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: `Mín (${symbol})`, data: mins, borderColor:'#3498db', backgroundColor:'transparent', tension:0.3 },
          { label: `Máx (${symbol})`, data: maxs, borderColor:'#e74c3c', backgroundColor:'transparent', tension:0.3 }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { labels: { color: getComputedStyle(document.body).color } }
        },
        scales: {
          x: { ticks: { color: getComputedStyle(document.body).color } },
          y: { ticks: { color: getComputedStyle(document.body).color } }
        }
      }
    });
  } catch(e) {
    console.error(e);
  }
}

// ————— Navegación por teclado entre tarjetas —————
document.addEventListener('keydown', e => {
  const focus = document.activeElement;
  if (!focus.classList.contains('card')) return;

  // Izquierda / Derecha: mover foco
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    const cards = Array.from(document.querySelectorAll('.card'));
    const idx = cards.indexOf(focus);
    let nextIdx = e.key === 'ArrowRight' ? idx + 1 : idx - 1;
    if (nextIdx < 0) nextIdx = cards.length - 1;
    if (nextIdx >= cards.length) nextIdx = 0;
    cards[nextIdx].focus();
    e.preventDefault();
  }

  // Enter: refrescar esa tarjeta
  if (e.key === 'Enter') {
    const id = focus.id.replace('card-', '');
    // Si es local, no hay stateCode, podríamos recargar con coords guardadas
    if (id === 'local') {
      // opcional: navigator.geolocation.getCurrentPosition...
    } else {
      fetchWeatherByState(id);
    }
    e.preventDefault();
  }
});

/**
 * Aplica clases al header según hora y clima
/**
 * Aplica clases al header y actualiza el vídeo de fondo
 * @param {string} weatherMain — "Clear", "Rain", "Snow", etc.
 */
/**
 * Aplica clases al header y actualiza el vídeo de fondo
 * Solo maneja 4 archivos: clear-day/night, rain-day/night
 */
/**
 * mood dinámico según clima y hora LOCAL de la ciudad
 * @param {string} weatherMain — "Clear", "Rain", etc.
 * @param {number} timezone    — offset en segundos desde UTC
 */
function updateHeaderMood(weatherMain, timezone) {
  const header = document.querySelector('.header-container');
  const video  = header.querySelector('.bg-video');
  if (!video) return;

  header.classList.remove('day','night','clear','rain');

  // hora local de la ciudad
  const utcMs = Date.now();
  const local = new Date(utcMs + timezone * 1000);
  const hour  = local.getUTCHours();
  const timeClass = (hour >= 6 && hour < 18) ? 'day' : 'night';
  header.classList.add(timeClass);

  let weatherClass = weatherMain.toLowerCase();
  if (weatherClass !== 'rain') weatherClass = 'clear';
  header.classList.add(weatherClass);

  const fileName = `${weatherClass}-${timeClass}.mp4`;
  const path     = `videos/${fileName}`;

  video.classList.remove('visible');
  video.pause(); video.currentTime = 0;

  fetch(path, { method: 'HEAD' })
    .then(res => {
      if (res.ok) {
        video.src = path;
        video.load(); video.play().catch(()=>{});
        video.addEventListener('loadeddata', () => {
          video.classList.add('visible');
        }, { once: true });
      }
    })
    .catch(console.error);
}




async function fetchWeatherByCity(query) {
  const unit   = localStorage.getItem('unit') || 'metric';
  const symbol = unit === 'metric' ? '°C' : '°F';
  const tempId = `card-${query.replace(/[^a-z0-9]/gi, '')}`;
  if (document.getElementById(tempId)) return;

  const loadingCard = document.createElement('div');
  loadingCard.className = 'card loading';
  loadingCard.id = tempId;
  cardsContainer.appendChild(loadingCard);

  try {
    const geoRes = await fetch(
      `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=1&appid=${apiKey}`
    );
    if (!geoRes.ok) throw new Error('Ciudad no encontrada');
    const [loc] = await geoRes.json();
    if (!loc) throw new Error('Ciudad no encontrada');
    const { lat, lon, name, country } = loc;

    const wRes = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=${unit}&appid=${apiKey}`
    );
    if (!wRes.ok) throw new Error('Error al obtener clima');
    const w = await wRes.json();

// ← Aquí pasamos también w.timezone
updateHeaderMood(w.weather[0].main, w.timezone);


    const uviRes = await fetch(
      `https://api.openweathermap.org/data/2.5/uvi?lat=${lat}&lon=${lon}&appid=${apiKey}`
    );
    const { value: uvi } = await uviRes.json();

    loadingCard.remove();

    createCard(query, {
      name: `${name}, ${country}`,
      main: w.main,
      weather: w.weather,
      visibility: w.visibility,
      sys: w.sys,
      wind: { speed: w.wind.speed },
      uvi,
      lat, lon,
      symbol,
      timezone: w.timezone   // ← Añade esta línea
    });
    

  } catch (err) {
    loadingCard.className = 'card error fade-out';
    loadingCard.innerHTML = `<div>⚠️ ${err.message}</div>`;
    setTimeout(() => loadingCard.remove(), 3000);
  }
}





