/////////////////////////////////////////////////
// SAFE LOCAL STORAGE LOAD  (FIX 1)
/////////////////////////////////////////////////
function loadFoldersFromStorage(){
  try{
    const data = JSON.parse(localStorage.getItem("folders"));
    if(Array.isArray(data)) return data;
    return [];
  }catch(e){
    return [];
  }
}

let folders = loadFoldersFromStorage();

/////////////////////////////////////////////////
// HOME PAGE
/////////////////////////////////////////////////
if(document.getElementById("folderList")){

  const list = document.getElementById("folderList");
  const search = document.getElementById("search");

  function showFolders(data){
    list.innerHTML = "";

    if(!Array.isArray(data)) return;

    data.forEach((f,i)=>{
      const div = document.createElement("div");
      div.className = "card";
      div.innerHTML = "📁 " + f.name;

      div.onclick = ()=>{
        localStorage.setItem("currentFolder", i);
        window.location = "folder.html";
      };

      list.appendChild(div);
    });
  }

  showFolders(folders);

  //////////////////////////////////////////////////
  // CREATE FOLDER  (FIX 2 → GLOBAL FUNCTION)
  //////////////////////////////////////////////////
  window.createFolder = function(){
    const name = document.getElementById("folderName").value.trim();
    if(!name) return alert("Enter party name");

    folders.push({ name:name, files:[] });

    localStorage.setItem("folders", JSON.stringify(folders));
    location.reload();
  }

  //////////////////////////////////////////////////
  // SEARCH
  //////////////////////////////////////////////////
  search.oninput = ()=>{
    const text = search.value.toLowerCase();
    const filtered = folders.filter(f =>
      f.name.toLowerCase().includes(text)
    );
    showFolders(filtered);
  }
}

/////////////////////////////////////////////////
// FOLDER PAGE
/////////////////////////////////////////////////
if(document.getElementById("fileInput")){

  const index = localStorage.getItem("currentFolder");
  if(index === null){
    alert("No folder selected");
    window.location = "index.html";
  }

  const folder = folders[index];
  const fileList = document.getElementById("fileList");
  const title = document.getElementById("folderTitle");

  title.innerText = "📁 " + folder.name;

  showFiles();
  drawCalendar();

  //////////////////////////////////////////////////
  // UPLOAD FILE
  //////////////////////////////////////////////////
  window.uploadFile = function(){
    const file = document.getElementById("fileInput").files[0];
    if(!file) return alert("Select file");

    const reader = new FileReader();
    reader.onload = function(){
      const today = new Date().toISOString().slice(0,10);

      folder.files.push({
        name:file.name,
        data:reader.result,
        date:today
      });

      localStorage.setItem("folders", JSON.stringify(folders));
      location.reload();
    }
    reader.readAsDataURL(file);
  }

  //////////////////////////////////////////////////
  // SHOW FILES
  //////////////////////////////////////////////////
  function showFiles(){
    fileList.innerHTML = "";

    folder.files.forEach(f=>{
      const div = document.createElement("div");
      div.className="fileRow";

      div.innerHTML = `
        <span>${f.name}</span>
        <button onclick="openFile('${f.data}')">OPEN</button>
      `;

      fileList.appendChild(div);
    });
  }

  window.openFile = function(data){
    window.open(data);
  }

  //////////////////////////////////////////////////
  // CALENDAR MARK
  //////////////////////////////////////////////////
  function drawCalendar(){
    const cal = document.getElementById("calendar");
    const billDates = folder.files.map(f=>f.date.split("-")[2]);

    for(let i=1;i<=31;i++){
      const day = String(i).padStart(2,'0');
      const className = billDates.includes(day) ? "day mark" : "day";
      cal.innerHTML += `<div class="${className}">${i}</div>`;
    }
  }
}