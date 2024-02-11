import './style.css';
import majora from './majora.json';
import vampire from './vampire.json';
import hamlet from './hamlet.json';
import tube from './tube.json';

let people = [];
let mostRecentlyAssignedID = 0;
let currentFocalPerson = null;
let spiderDiagramAvoidPeople = [];
let roles = [];

let canvas = document.getElementById("canvas");

let ctx = canvas.getContext("2d");
ctx.canvas.width  = window.innerWidth;
ctx.canvas.height = window.innerHeight;
let canvasPanX = 0; //is set to its default elsewhere
let canvasPanY = 0; //is set to its default elsewhere

let colouredConnectionTexts = {};
let USE_COLOURED_CONNECTION_TEXTS = false;
let ALWAYS_SETTLE_FOR_VACANT = true;

let notification = document.getElementById("notification");

document.addEventListener('keyup', (e) => {
  let change = 20;
 switch (e.key){
    case "w":
        canvasPanY += change;
        updateHTML();
    break;
    case "s":
        canvasPanY -= change;
        updateHTML();
    break;
    case "a":
        canvasPanX += change;
        updateHTML();
    break;
    case "d":
        canvasPanX -= change;
        updateHTML();
    break;
  }
});

let oldMousePos = null;

function mousedownFunction (e){
  oldMousePos = [e.screenX, e.screenY];  
}

function mouseMoveFunction (e){
  if (oldMousePos != null){
    canvasPanX += (e.screenX - oldMousePos[0]);
    canvasPanY += (e.screenY - oldMousePos[1]);
    oldMousePos = [e.screenX, e.screenY];      
    updateHTML();
}
}

function mouseUpFunction(e){
  oldMousePos = null;
}

canvas.addEventListener("mousedown", (e) => {
    mousedownFunction(e);
});

canvas.addEventListener("mousemove", (e) => {
  mouseMoveFunction(e);
});

canvas.addEventListener("mouseup", (e) => {
  mouseUpFunction(e);
});

notification.addEventListener("mousedown", (e) => {
  mousedownFunction(e);
});

notification.addEventListener("mousemove", (e) => {
  mouseMoveFunction(e);
});

notification.addEventListener("mouseup", (e) => {
  mouseUpFunction(e);
});

function reset(){
  mostRecentlyAssignedID = 0;
  people = [];
  roles = [];
  colouredConnectionTexts = {};
  spiderDiagramAvoidPeople = [];
  ALWAYS_SETTLE_FOR_VACANT = true;
  USE_COLOURED_CONNECTION_TEXTS = true;
}

function setCurrentFocalPerson(p){
  currentFocalPerson = p;
  canvasPanX = -window.innerWidth/10;
  canvasPanY = -window.innerHeight/14;
  recalculateSpiderDiagram();
  updateHTML();
}

function setupAfterLoad(){

  if (people.length == 0){
    console.log("There are no people in the people array!")
    return;
  }

  people.forEach((person)=>{
    if (person.myRoles.length > 0 && !person.roleRelationsHaveBeenAddedToPerson){ //just bandwagoning here to make sure all the role relations are added to the relevant people
      person.myRoles.forEach((role) => {
        getRoleByName(role).relations.forEach((roleRelation)=>{
          person.addRelation(roleRelation.getOtherPerson(),roleRelation.description,null,false,true)
        })
      });
      person.roleRelationsHaveBeenAddedToPerson = true;
    }
  });

  autoCentre();
}

function autoCentre(){
  spiderDiagramAvoidPeople = [];
  let USE_MOST_IMMEDIATE_CONNECTIONS_INSTEAD = false; //makes for a good backup if you want it to render a bit faster

  if (USE_MOST_IMMEDIATE_CONNECTIONS_INSTEAD){
    setCurrentFocalPerson(getPersonWithMostImmediateConnections())
    notification.innerHTML = "(Auto-centring on the point with the most immediate connections (<strong>"+currentFocalPerson.name +"</strong>)";
  } else {
    setCurrentFocalPerson(getPersonWithFewestLevels())
    notification.innerHTML = "(Auto-centring on most efficient centre point (<strong>"+currentFocalPerson.name +"</strong>)";
  }
  
  notification.style = ""
  notification.className = "";
  notification.className = "fadeout";
  notificationCooldown();
}

function loadAllFromJsonString(jsonString){
  loadAllFromJson(JSON.parse(jsonString));
}

function loadAllFromJson(obj){
   reset();

   if (obj instanceof Array){
    console.log("Loading version 1 file")
    loadFromVersion1JsonFile(obj);
   } else {
    console.log("Loading version 2 file")
    loadFromVersion2JsonFile(obj);
   }
   setupAfterLoad();
}

function loadFromVersion1JsonFile(obj){ //loads from a V1 json file - where the root is just the people array, rather than also having settings next to it.
  obj.forEach((jsonPersonObj) => {
    people.push(makePersonFromJSONPerson(jsonPersonObj))
  })

  //and now that all the people (and importantly, their IDs) are in place, restore their relations

  obj.forEach((jsonPersonObj) => {
    let person = getPersonById(jsonPersonObj.id);
    jsonPersonObj.relations.forEach((jsonRelationObj) => {
      person.relations.push(new Relation(getPersonById(jsonRelationObj.personId), getPersonById(jsonRelationObj.otherPersonId), jsonRelationObj.description));
    });
  });
}

function loadFromVersion2JsonFile(obj){ //loads from a V2 json file - where the root is an object and there are settings within
  
  let jsonPeople = obj.jsonPeople;
  let jsonRoles = obj.jsonRoles;
  let jsonSettings = obj.jsonSettings;

  if (jsonSettings != null){
    Object.keys(jsonSettings).forEach((key) => {
      switch (key){
        case "colouredConnectionTexts":
          colouredConnectionTexts = jsonSettings.colouredConnectionTexts;
        break;
        case "USE_COLOURED_CONNECTION_TEXTS":
          USE_COLOURED_CONNECTION_TEXTS = jsonSettings.USE_COLOURED_CONNECTION_TEXTS;
        break;
        case "ALWAYS_SETTLE_FOR_VACANT":
          ALWAYS_SETTLE_FOR_VACANT = jsonSettings.ALWAYS_SETTLE_FOR_VACANT;
        break;
      }
    });
  }
  
  jsonPeople.forEach((jsonPersonObj) => {
    people.push(makePersonFromJSONPerson(jsonPersonObj))
  })

  jsonRoles.forEach((jsonRoleObj) => {
    roles.push(makeRoleFromJSONRole(jsonRoleObj));
  });

  //and now that all the people (and importantly, their IDs) are in place, restore their relations
  
  jsonRoles.forEach((jsonRoleObj) => {
    let role = getRoleByName(jsonRoleObj.name);
    jsonRoleObj.relations.forEach((jsonRelationObj) => {
      role.relations.push(new Relation(jsonRelationObj.type[0] == "P" ? getPersonById(jsonRelationObj.firstThing) : getRoleByName(jsonRelationObj.firstThing),
                                       jsonRelationObj.type[1] == "P" ? getPersonById(jsonRelationObj.otherThing) : getRoleByName(jsonRelationObj.otherThing),
                                        jsonRelationObj.description,
                                        jsonRelationObj.type));
    });
  });

  jsonPeople.forEach((jsonPersonObj) => {
    let person = getPersonById(jsonPersonObj.id);
    jsonPersonObj.relations.forEach((jsonRelationObj) => {
      person.relations.push(new Relation(jsonRelationObj.type[0] == "P" ? getPersonById(jsonRelationObj.firstThing) : getRoleByName(jsonRelationObj.firstThing),
                                         jsonRelationObj.type[1] == "P" ? getPersonById(jsonRelationObj.otherThing) : getRoleByName(jsonRelationObj.otherThing),
                                         jsonRelationObj.description,
                                         jsonRelationObj.type));
    });
  });
}

function makePersonFromJSONPerson(jsonPersonObj){

  let p = new Person();
  p.id = jsonPersonObj.id;
  p.name = jsonPersonObj.name;  
  p.relations = []; //this gets filled later on, in the function that calls this method (because it needs all the person objects to already be in place before it starts linking them together)
  if (jsonPersonObj.myRoles != null){
    p.myRoles = jsonPersonObj.myRoles;
  }
  return p;
}

function makeRoleFromJSONRole(jsonRoleObj){

  let r = new Role();
  r.name = jsonRoleObj.name;  
  r.relations = []; //this gets filled later on, in the function that calls this method (because it needs all the role objects to already be in place before it starts linking them together)
  return r;
}


function getAllAsJSON(){
  let output = {};

  let jsonPeople = [];

  people.forEach((person) => {
    jsonPeople.push(person.getAsObjectForJSON());
  })

  let jsonRoles = [];

  roles.forEach((role) => {
    jsonRoles.push(role.getAsObjectForJSON());
  })

  output["jsonPeople"] = jsonPeople;
  output["jsonRoles"] = jsonRoles;
  output["jsonSettings"] = {colouredConnectionTexts:colouredConnectionTexts,
                            USE_COLOURED_CONNECTION_TEXTS:USE_COLOURED_CONNECTION_TEXTS,
                            ALWAYS_SETTLE_FOR_VACANT:ALWAYS_SETTLE_FOR_VACANT};


  return JSON.stringify(output);
}

function updateHTML(){
    let app = document.getElementById("app");
    app.innerHTML = "";
    app.appendChild(currentFocalPerson.getAnchorTag());
    app.appendChild(currentFocalPerson.getRelationsDiv());
    globalCanvasRedraw();
}

function globalCanvasRedraw(){
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  people.forEach((person) => {
    person.drawToCanvas();
  });
}

function recalculateSpiderDiagram(){

  let peopleWebContexts = [];

  let maxLevel = -1;
  let slotsAtEachLevel = {};

  let MONITOR_NODES_THAT_COULD_NOT_BE_REACHED = false;

  let couldNotBeReached = [];

  people.forEach((otherPerson) => {

	 if (spiderDiagramAvoidPeople.includes(otherPerson)){
		 return;
	 }
	  
    let level = currentFocalPerson.getDegreesOfSeparationFrom(otherPerson, spiderDiagramAvoidPeople);
	
	  if (level == undefined){
      if (MONITOR_NODES_THAT_COULD_NOT_BE_REACHED){
        couldNotBeReached.push(otherPerson);
      }      
      return;
	  }
		
    if (level > maxLevel){
      maxLevel = level;
    }

    if (Object.keys(slotsAtEachLevel).includes(level+"")){
      slotsAtEachLevel[level+""] = slotsAtEachLevel[level+""] + 1;
    } else {
      slotsAtEachLevel[level+""] = 1;
    }
    
	let otherPersonAndWebContext = {p:otherPerson, degreesFromFocalPerson: level, isAddedToWeb:false, prevPersonInWeb:null};
	peopleWebContexts.push(otherPersonAndWebContext);
  });    

  if (MONITOR_NODES_THAT_COULD_NOT_BE_REACHED){
    let couldNotBeReachedString = "The following nodes could not be reached from the chosen centrepoint: ";

    couldNotBeReached.forEach((item) => {
      couldNotBeReachedString += item.name + ", ";
    })
    console.log(couldNotBeReachedString)
  }

  for (let L = 0; L <= maxLevel; L++){
    let slots = []; //'slots' are a bunch of slots in a ring around the focal person, at the required distance, that can be filled up with person nodes. This means that people will never crash into each other!

    let slotCount = Object.keys(slotsAtEachLevel).includes((L)+"") ? (slotsAtEachLevel[L] * L) : 1;
    let spider_diagram_arm_length = L * 400;
  
    let angle_diff = 360 / slotCount;

    for (let i = 0; i < slotCount; i++){
        let angle_in_rads = deg2rad((angle_diff * i));
        let armXLength = (Math.sin(angle_in_rads) * spider_diagram_arm_length);
        let armYLength = (Math.cos(angle_in_rads) * spider_diagram_arm_length);
        let newSlot = {
          position: [currentFocalPerson.positionOnSpiderDiagram[0] + armXLength, currentFocalPerson.positionOnSpiderDiagram[1] + armYLength],
          occupant: null,
          distOfOccupantToPrev: 999999999
          };
        slots.push(newSlot);
    }

    peopleWebContexts.forEach((personWebContext) => {

      if (personWebContext.degreesFromFocalPerson == L){
        if (personWebContext.prevPersonInWeb == null){ //then this is the root person and they get special treatment!
          personWebContext.p.positionOnSpiderDiagram = [canvas.width/2, canvas.height/2];
        }

        personWebContext.isAddedToWeb = true;

        personWebContext.p.relations.forEach((relation) => {
          for (let i = 0; i < peopleWebContexts.length; i++){
            let otherPersonWebCtx = peopleWebContexts[i];
            if (otherPersonWebCtx.p == relation.getOtherPerson()){ //if the other person in this relationship is already added to the web, don't add them again. The return returns the forEach iteration in the relations array, not the wider function.
              if (otherPersonWebCtx.isAddedToWeb){
                return;
              } else {
                otherPersonWebCtx.prevPersonInWeb = personWebContext.p;
                otherPersonWebCtx.isAddedToWeb = true;
              }
            }
          }
        });

        //find the next closest available slot in this level's ring, and put this person node at the location of that slot

        if (personWebContext.prevPersonInWeb != null){

          let closestOccupiedDist = 999999999;
          let closestOccupiedSlot = null;

          let closestVacantDist = 999999999;
          let closestVacantSlot = null;

          slots.forEach((slot)=>{            
              let dist = getDistanceBetween(slot.position, personWebContext.prevPersonInWeb.positionOnSpiderDiagram);
              if (slot.occupant != null && dist < closestOccupiedDist){ //set the closest dist for a slot that is occupied (the ideal slot, that we might even boot something out of, if this one is a better fit)
                closestOccupiedDist = dist;
                closestOccupiedSlot = slot;
              }
              else if (slot.occupant == null && dist < closestVacantDist){ //set the closest dist for a slot that isn't occupied (a good enough slot if the occupant of our preferred slot turns out to have a better claim to it)
                closestVacantDist = dist;
                closestVacantSlot = slot;
              }
          });

          if (closestVacantDist <= closestOccupiedDist){ //hooray! We got our first choice!
              personWebContext.p.positionOnSpiderDiagram = closestVacantSlot.position;
              closestVacantSlot.distOfOccupantToPrev = closestVacantDist;
              closestVacantSlot.occupant = personWebContext;
          } else {  //something else is in the slot that we want :( check its claim and swap if necessary
            let competingOccupant = closestOccupiedSlot.occupant;
            if (closestOccupiedSlot.distOfOccupantToPrev <= closestOccupiedDist || ALWAYS_SETTLE_FOR_VACANT){ //they have a better claim, so we settle for the vacant slot
              personWebContext.p.positionOnSpiderDiagram = closestVacantSlot.position;
              closestVacantSlot.distOfOccupantToPrev = closestVacantDist;
              closestVacantSlot.occupant = personWebContext;
            } else {  //we have a better claim! Swap slots with them!
              //put them into the second best slot:
              console.log(competingOccupant.p.name + " kicked out of its spot by a better candidate ("+personWebContext.p.name+")!")
              competingOccupant.p.positionOnSpiderDiagram = closestVacantSlot.position;
              closestVacantSlot.distOfOccupantToPrev = getDistanceBetween(competingOccupant.prevPersonInWeb, competingOccupant.p.positionOnSpiderDiagram);
              closestVacantSlot.occupant = competingOccupant;
              competingOccupant.p.updateConnectionLinePositions(competingOccupant.prevPersonInWeb);
              //and put ourselves in the best slot:
              personWebContext.p.positionOnSpiderDiagram = closestOccupiedSlot.position;
              closestOccupiedSlot.distOfOccupantToPrev = closestOccupiedDist;
              closestOccupiedSlot.occupant = personWebContext;
            }
          }          
        }
        personWebContext.p.updateConnectionLinePositions(personWebContext.prevPersonInWeb);
      }
    });
  }
}

function getDistanceBetween(a,b){
  return Math.hypot(a[0] - b[0], a[1] - b[1])
}

function deg2rad(deg){
  return (deg * Math.PI) / 180.0;
}

function getPerson(name){
  name = name.toLowerCase();
  for (let i = 0; i < people.length; i++){
    let p = people[i];
    if (p.name.toLowerCase() == name){
      return p;
    }
  }

  console.log("Couldn't find person with name: "+name);
  return null;
}

function getPersonById(id){
  id = parseInt(id);
  for (let i = 0; i < people.length; i++){
    let p = people[i];
    if (p.id == id){
      return p;
    }
  }
  return null;
}

function getPersonByRole(role){
  for (let i = 0; i < people.length; i++){
    if (people[i].myRoles.includes(role)){
      return people[i];
    }
  }
  return null;
}

function getRoleByName(role){
  for (let i = 0; i < roles.length; i++){
    if (roles[i].name == role){
      return roles[i];
    }
  }
}

function getPersonWithMostImmediateConnections(){
  let highest = people[0];
  let lowest = people[0];

  console.log("Getting the person with the most immediate connections...");

  people.forEach((person) => {
    if (person.relations.length > highest.relations.length && !spiderDiagramAvoidPeople.includes(person)){
      highest = person;
    }
    if (person.relations.length < lowest.relations.length && person.relations.length != 0 && !spiderDiagramAvoidPeople.includes(person)){
      lowest = person;
    }
  });
  console.log("Btw, person with lowest non-zero number of immediate connections: "+lowest.name+" with "+lowest.relations.length +" immediate connections")
  return highest;
}

function getPersonWithFewestLevels(){
  console.log("Starting analysis of the most efficient centrepoint...")

  let fewestPerson = people[0];
  let fewest = 99999999;

  people.forEach((person) => {
    if (person.relations.length > 1){
      let maxLevelWithThisPersonAtCentre = person.getDegreesOfSeparationFrom(null, spiderDiagramAvoidPeople, true);

      if (maxLevelWithThisPersonAtCentre != 0 && maxLevelWithThisPersonAtCentre < fewest){
        fewest = maxLevelWithThisPersonAtCentre;
        fewestPerson = person;
      }
    }
  });
  
  console.log(""+fewestPerson.name+" is the best-connected individual, with the fewest levels to their spider web ("+fewest+")")

  return fewestPerson;
}


function getNextID(){
  return mostRecentlyAssignedID++;
}

function addPerson(name){
  people.push(new Person(name));
}  

class Role {
  constructor(name){
    this.name = name;
    this.relations = [];
  }

  addRelation(otherThing,description,reverseDescription,createReverseRelationNow){
    this.relations.push(new Relation(this,otherThing,description));
    if (createReverseRelationNow){
      otherThing.relations.push(new Relation(otherThing,this,reverseDescription));
      }
  }

  getAsObjectForJSON(){
    let jsonRelations = [];

    this.relations.forEach((relation) => {
      jsonRelations.push(relation.getJSONFriendlyVersion());
    });

    return {name:this.name, relations:jsonRelations};
  }
}

class Person {
  constructor (name) {
      this.id = getNextID();
      this.name = name;
      this.relations = [];
      this.positionOnSpiderDiagram = [0,0];
      this.connectionLineStart = [0,0];
      this.connectionLineEnd = [0,0];
      this.connectionTextPosition = [0,0];
      this.connectionTextWithPrevOnVisualWeb = "";
      this.myRoles = [];
      this.roleRelationsHaveBeenAddedToPerson = false;
  }

  addRelation(otherPerson,description,reverseDescription,createReverseRelationNow,isAutogeneratedFromRoleRelation){
    if (isAutogeneratedFromRoleRelation == null){ //this exists to make sure these kinds of relations don't get saved to file, because their role equivalents, from which they derive, are saved instead
      isAutogeneratedFromRoleRelation = false;
    }
    let newRelation = new Relation(this,otherPerson,description);
    newRelation.isAutogeneratedFromRoleRelation = isAutogeneratedFromRoleRelation;
    this.relations.push(newRelation);
    

    if (createReverseRelationNow){
      let reverseRelation = new Relation(otherPerson,this,reverseDescription);
      reverseRelation.isAutogeneratedFromRoleRelation = isAutogeneratedFromRoleRelation;
      otherPerson.relations.push(reverseRelation);
    }
  }

  setRole(role){
    let newRole = new Role(role);

    for (let i = 0; i < roles.length; i++){
      if (roles[i].name == role){
        roles[i] = newRole;
        this.myRoles.push(role); //intentionally set to the string version
        return;
      }
    }

    roles.push(newRole);
    this.myRoles.push(role); //intentionally set to the string version
  }

  getAnchorTag(){
    let a = document.createElement("a");
    a.innerHTML = "<strong>"+this.name+"</strong>";
    a.onclick = () => {setCurrentFocalPerson(this)};
    return a;
  }

  getRelationsDiv(){
    let ul = document.createElement("ul");
    this.relations.forEach((relation) => { 
      let li = document.createElement("li");
      let a = document.createElement("a");
      a.innerHTML = relation.description + " <strong>" + (relation.getOtherPerson() == this ? "themselves" : relation.getOtherPerson().name) + "</strong>";
      a.onclick = () => {setCurrentFocalPerson(relation.getOtherPerson())};
      li.appendChild(a);
      ul.appendChild(li);
    });
    return ul;
  }

  getImmediateRelationshipTextTo(otherPerson){
    let text = "is not immediately related to";

    this.relations.forEach((relation) => {
      if (relation.getOtherPerson() == otherPerson)
        {
          text = relation.description;
        }
    });

    return text;
  }

  updateConnectionLinePositions(prevPerson){
    let armXLength = 0;
    let armYLength = 0;
    
    if (prevPerson != null){
      armXLength = this.positionOnSpiderDiagram[0] - prevPerson.positionOnSpiderDiagram[0]
      armYLength = this.positionOnSpiderDiagram[1] - prevPerson.positionOnSpiderDiagram[1];
    
      this.connectionLineStart = [this.positionOnSpiderDiagram[0] - (armXLength/15),
                                  this.positionOnSpiderDiagram[1] - (armYLength/15)];

      this.connectionLineEnd = [this.positionOnSpiderDiagram[0] - (armXLength*(9/10)),
                                this.positionOnSpiderDiagram[1] - (armYLength*(9/10))];

      this.connectionTextPosition = [this.positionOnSpiderDiagram[0] - (armXLength / 2),
                                    this.positionOnSpiderDiagram[1] - (armYLength / 2)];

      if (armXLength < 0){
        this.connectionTextWithPrevOnVisualWeb = prevPerson.getImmediateRelationshipTextTo(this); //these two have temporarily, or maybe permanently, been made the same, because it flows better now that the web is concentric
      }  else {
        this.connectionTextWithPrevOnVisualWeb = prevPerson.getImmediateRelationshipTextTo(this);
      }                                  

      let hypotenuse = getDistanceBetween([0,0],[armXLength,armYLength]);
      
      if (armXLength < 0){
        this.connectionTextAngle = -Math.acos(armYLength/hypotenuse);
      } else {
        this.connectionTextAngle = Math.acos(armYLength/hypotenuse);
      }

     
    } else {
      this.connectionTextWithPrevOnVisualWeb = null;
    }
  }

  drawToCanvas(){
    // Draw circle background:
    ctx.beginPath();
    ctx.arc(canvasPanX + this.positionOnSpiderDiagram[0], canvasPanY + this.positionOnSpiderDiagram[1], 50, 0, 2 * Math.PI);
    ctx.fillStyle = "black";
    //ctx.stroke(); 
    //ctx.fill();

    // Draw name text:
    ctx.font = "20px Arial";
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.name, canvasPanX + this.positionOnSpiderDiagram[0], canvasPanY + this.positionOnSpiderDiagram[1]);
    
    if (this.connectionTextWithPrevOnVisualWeb != null){
      // Draw connection line with previous node:
      ctx.beginPath(); 
      ctx.strokeStyle = "rgba(128,128,128,0.3)"; 
      ctx.moveTo(canvasPanX+this.connectionLineStart[0], canvasPanY+this.connectionLineStart[1]);
      ctx.lineTo(canvasPanX+this.connectionLineEnd[0], canvasPanY+this.connectionLineEnd[1]);
      ctx.stroke();

      // Draw connection description over connection line:
      ctx.font = "12px Arial";
	  if (USE_COLOURED_CONNECTION_TEXTS && Object.keys(colouredConnectionTexts).includes(this.connectionTextWithPrevOnVisualWeb.toLowerCase())){
		  ctx.fillStyle = colouredConnectionTexts[this.connectionTextWithPrevOnVisualWeb.toLowerCase()];
	  } else {
		ctx.fillStyle = "rgba(255,255,255,0.75)";  
	  }     
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.save();
      ctx.translate(canvasPanX + this.connectionTextPosition[0], canvasPanY + this.connectionTextPosition[1]);

      let angle = this.connectionTextAngle;

      if (angle >= Math.PI || angle < 0){
        ctx.rotate(-angle - 1.5708);
      } else {
        ctx.rotate(-angle + 1.5708);
      }

      if (this.connectionTextWithPrevOnVisualWeb != null){
        ctx.fillText(this.connectionTextWithPrevOnVisualWeb,0,0);  
      }
        
      ctx.restore();   
    }
  }

  getAsObjectForJSON(){
    let JSONfriendlyRelations = [];
    for (let i = 0; i < this.relations.length; i++){
      let r = this.relations[i]; 
      if (!r.isAutogeneratedFromRoleRelation){ //we don't save these ones, because the role equivalents, from which they derive, are saved instead
        JSONfriendlyRelations.push(this.relations[i].getJSONFriendlyVersion());
      }
    }
    return {name: this.name, id:this.id, relations:JSONfriendlyRelations, myRoles:this.myRoles};
  }

  getDegreesOfSeparationAsStringFrom(targetPerson, avoidPeople){
    let reportString = this.name + " is " + this.getDegreesOfSeparationFrom(targetPerson,avoidPeople) + " degrees away from " + targetPerson.name+".";
	if (avoidPeople != null && avoidPeople.length > 0){
		reportString += getAvoidingText(avoidPeople);
	}
	 return reportString;
  }

  getDegreesOfSeparationFrom(targetPerson, avoidPeople, getMaxExtentOfWebInstead){
    
    if (targetPerson == this){
      return 0;
    }

    if (getMaxExtentOfWebInstead == null){
      getMaxExtentOfWebInstead = false;
    }

    if (avoidPeople == null){
      avoidPeople = [];
    }

    let peopleAndCounts = {};
    let peopleAndPrevPeople = {};

    let alreadyProcessedPeople = [];

    peopleAndCounts[this.id] = 0;
    peopleAndPrevPeople[this.id] = null;

    let targetFound = false;

    let DEBUG_LOOPS_LIMIT = 5000;
    let DEBUG_LOOPS_COUNT = 0;

    let maxLevelEncountered = 0;

    while (!targetFound && alreadyProcessedPeople.length != Object.keys(peopleAndCounts).length){
        if (DEBUG_LOOPS_COUNT > DEBUG_LOOPS_LIMIT){
          break;
        }

        //get person with lowest score in peopleAndCounts

        let lowest = 99999999999;
        let lowest_person = null;

        Object.keys(peopleAndCounts).forEach((personId) => {
            if (peopleAndCounts[personId] < lowest && !alreadyProcessedPeople.includes(personId)){
              lowest = peopleAndCounts[personId];
              lowest_person = personId;
            }
        });

        alreadyProcessedPeople.push(lowest_person);

        //Expand this person with the lowest score

        getPersonById(lowest_person).relations.forEach((relation) => {
            if (!Object.keys(peopleAndCounts).includes(relation.getOtherPersonId()+"") && !avoidPeople.includes(relation.getOtherPerson())){
              peopleAndCounts[relation.getOtherPerson().id] = lowest + 1; //set the score for the next person we're going to expand
              peopleAndPrevPeople[relation.getOtherPerson().id] = getPersonById(lowest_person); //set the prev person
           
              if (relation.getOtherPerson() == targetPerson){
                targetFound = true;
              }
            }
        })

        if (lowest > maxLevelEncountered){
          maxLevelEncountered = lowest;
        }

        DEBUG_LOOPS_COUNT++;
    }

    if (getMaxExtentOfWebInstead){
      return maxLevelEncountered;
    }

    let reportString = this.name + " is " + peopleAndCounts[targetPerson.id] + " degrees away from " + targetPerson.name+".";

    if (targetFound){
      let curPerson = targetPerson;
      let prev = peopleAndPrevPeople[targetPerson.id];
      
      let firstLoop = true;

        while (prev != null) {
          reportString += curPerson.name + (firstLoop ? " " : ", who ") + curPerson.getImmediateRelationshipTextTo(prev);

          if (prev == this){
            reportString += " " + this.name + ".";
            break;
          } else {
            reportString += " ";
          }

          curPerson = prev;
          prev = peopleAndPrevPeople[curPerson.id];

          firstLoop = false;
        }
    }
    else {
      reportString = this.name + " is not connected to " + targetPerson.name;
    }
	
	if (avoidPeople.length > 0){
        reportString += getAvoidingText(avoidPeople);
      }

    return peopleAndCounts[targetPerson.id];
  }
}

function getAvoidingText(avoidPeople){
  let text = "";

  if (avoidPeople.length > 0){
    text += " (Avoiding: "
    avoidPeople.forEach((avoidPerson) => {	
      text += avoidPerson.name + " ";
    })  
    text +=")";
  }
  return text;
}

class Relation {
  constructor(firstThing, otherThing, description, type){
    this.firstThing = firstThing;
    this.otherThing = otherThing;
    this.description = description;
    this.type = "";
    this.isAutogeneratedFromRoleRelation = false;

    if (type == null){
      this.type == "PP";
    }

    if (this.firstThing instanceof Person){
      this.type += "P";
    } else {
      this.type += "R";
    }

    if (this.otherThing instanceof Person){
      this.type += "P";
    } else {
      this.type += "R";
    }
  } 

  getOtherPerson(){
    return this.type[1] == "P" ? this.otherThing : getPersonByRole(this.otherThing.name);
  }

  getOtherPersonId(){
    return this.type[1] == "P" ? this.otherThing.id : getPersonByRole(this.otherThing.name).id;
  }

  getJSONFriendlyVersion(){
    return {firstThing:this.type[0] == "P" ? this.firstThing.id : this.firstThing.name,
            otherThing:this.type[1] == "P" ? this.otherThing.id : this.otherThing.name,
            description:this.description,
            type:this.type};
  }
}

function makeOptionFor(json, name){
  let newOption = document.createElement("option");
  newOption.innerHTML = name;
  newOption.onclick = ()=>{loadAllFromJson(json)};
  return newOption;
}

dropdown.appendChild(makeOptionFor(vampire, "Vampire"));
dropdown.appendChild(makeOptionFor(majora, "Zelda Majora's Mask"));
dropdown.appendChild(makeOptionFor(hamlet, "Hamlet"));

reset();
dropdown.children[0].click();