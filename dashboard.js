const map = L.map("map").setView([31.5, 40.5], 5);

L.tileLayer(
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  {
    attribution: "&copy; OpenStreetMap contributors & Carto"
  }
).addTo(map);

const clusters = L.markerClusterGroup();
map.addLayer(clusters);

let incidents = [];
let markerRefs = [];
let chartInstance = null;

fetch("incidents.json")
  .then(res => res.json())
  .then(data => {
    incidents = data;
    populateFilters();
    applyFilters();
  })
  .catch(err => {
    console.error("Failed to load incidents:", err);
  });

function populateFilters() {

  const countries = [...new Set(incidents.map(i => i.country))];
  const types = [...new Set(incidents.map(i => i.type))];

  const countryFilter = document.getElementById("countryFilter");
  const typeFilter = document.getElementById("typeFilter");

  countries.forEach(c => {
    const option = document.createElement("option");
    option.value = c;
    option.textContent = c;
    countryFilter.appendChild(option);
  });

  types.forEach(t => {
    const option = document.createElement("option");
    option.value = t;
    option.textContent = t;
    typeFilter.appendChild(option);
  });

}

function renderMarkers(data) {

  clusters.clearLayers();
  markerRefs = [];

  const bounds = [];

  data.forEach((incident, index) => {

    if (!incident.lat || !incident.lng) return;

    let color = "gray";

    const type = incident.type.toLowerCase();

    if(type.includes("drone")) color="purple";
    if(type.includes("missile")) color="red";
    if(type.includes("airstrike")) color="orange";

    const icon = L.divIcon({
      className: "custom-marker",
      html: `<div style="
        background:${color};
        width:12px;
        height:12px;
        border-radius:50%;
        border:2px solid white;
      "></div>`
    });

    const popupHtml = `
      <div class="popup-card">
        <h3>${incident.title}</h3>
        <p><strong>Date:</strong> ${incident.date}</p>
        <p><strong>Country:</strong> ${incident.country}</p>
        <p><strong>Region:</strong> ${incident.region}</p>
        <p><strong>Type:</strong> ${incident.type}</p>
        <p>${incident.summary}</p>
        ${incident.source ? `<a class="source-btn" href="${incident.source}" target="_blank">Open source</a>` : ""}
      </div>
    `;

    const marker = L.marker([incident.lat, incident.lng], {icon})
      .bindPopup(popupHtml);

    clusters.addLayer(marker);
    markerRefs[index] = marker;

    bounds.push([incident.lat, incident.lng]);

  });

  if(bounds.length){
    map.fitBounds(bounds,{padding:[50,50]});
  }

}

function renderList(data){

  const container = document.getElementById("incidentList");
  container.innerHTML="";

  document.getElementById("resultCount").textContent=data.length;

  data.slice(0,20).forEach((incident,index)=>{

    const div = document.createElement("div");
    div.className="incident";

    div.innerHTML=`
      <div class="incident-top">
        <strong>${incident.title}</strong>
        <span class="incident-type">${incident.type}</span>
      </div>

      <div class="incident-meta">${incident.date} · ${incident.country}</div>

      <div class="incident-region">${incident.region}</div>

      <div class="incident-summary">${incident.summary}</div>

      <div class="incident-actions">
        <button class="zoom-btn">View on map</button>
        ${incident.source ? `<a class="source-btn" href="${incident.source}" target="_blank">Open article</a>` : ""}
      </div>
    `;

    div.querySelector(".zoom-btn").onclick=()=>{
      map.setView([incident.lat,incident.lng],8);

      const marker=markerRefs[index];

      if(marker){
        clusters.zoomToShowLayer(marker,()=>{
          marker.openPopup();
        });
      }
    };

    container.appendChild(div);

  });

}

function updateStats(data){

  document.getElementById("totalIncidents").textContent=data.length;

  const countries=new Set(data.map(i=>i.country));
  document.getElementById("countryCount").textContent=countries.size;

  const types=new Set(data.map(i=>i.type));
  document.getElementById("typeCount").textContent=types.size;

}

function buildChart(data){

  const counts={};

  data.forEach(i=>{
    counts[i.date]=(counts[i.date]||0)+1;
  });

  const labels=Object.keys(counts);
  const values=Object.values(counts);

  if(chartInstance) chartInstance.destroy();

  chartInstance=new Chart(document.getElementById("timelineChart"),{

    type:"line",

    data:{
      labels:labels,
      datasets:[{
        label:"Incidents",
        data:values,
        borderColor:"#6fb1ff",
        backgroundColor:"rgba(111,177,255,0.2)",
        fill:true
      }]
    },

    options:{
      responsive:true,
      plugins:{
        legend:{
          labels:{color:"white"}
        }
      },
      scales:{
        x:{ticks:{color:"white"}},
        y:{ticks:{color:"white"}}
      }
    }

  });

}

function applyFilters(){

  const search=document.getElementById("search").value.toLowerCase();
  const country=document.getElementById("countryFilter").value;
  const type=document.getElementById("typeFilter").value;

  const filtered=incidents.filter(i=>{

    return(
      (country==="all"||i.country===country)&&
      (type==="all"||i.type===type)&&
      (i.title.toLowerCase().includes(search)||
       i.region.toLowerCase().includes(search))
    )

  });

  renderMarkers(filtered);
  renderList(filtered);
  updateStats(filtered);
  buildChart(filtered);

}

document.getElementById("search").addEventListener("input",applyFilters);
document.getElementById("countryFilter").addEventListener("change",applyFilters);
document.getElementById("typeFilter").addEventListener("change",applyFilters);
