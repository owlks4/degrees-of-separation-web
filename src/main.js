import majora from './majora.json';
import vampire from './vampire.json';
import hamlet from './hamlet.json';
import tube from './tube.json';

let people = [];
let mostRecentlyAssignedID = 0;
let currentFocalPerson = null;
let spiderDiagramAvoidPeople = [];
let spiderDiagramAvoidRelationText = [];
let roles = [];
let downloadImageAnchorTag = document.createElement("a");

let canvas = document.getElementById("canvas");

let ctx = canvas.getContext("2d");
ctx.canvas.width  = window.innerWidth;
ctx.canvas.height = window.innerHeight;
let canvasPanX = 0; //is set to its default elsewhere
let canvasPanY = 0; //is set to its default elsewhere

let colouredConnectionTexts = {};
let USE_COLOURED_CONNECTION_TEXTS = false;
let ALWAYS_SETTLE_FOR_VACANT = false;
let DRAW_ANGLED_NAME_TEXT = false;

let personA = document.getElementById("personA");
let personB = document.getElementById("personB");
let shortestPathAnswerText = document.getElementById("shortest-path-answer-text");

personA.addEventListener("change", (e) => {personConnectionDropdownChanged(true)});
personB.addEventListener("change", (e) => {personConnectionDropdownChanged(true)});

function personConnectionDropdownChanged(alsoUpdateHTML){
  people.forEach((person) => {
    person.unhighlightRelations();
  });
  let person1 = getPersonById(personA.selectedOptions[0].id.replace("option-for-person-with-id-",""));
  let person2 = getPersonById(personB.selectedOptions[0].id.replace("option-for-person-with-id-",""));
  shortestPathAnswerText.innerHTML = person1.getDegreesOfSeparationAsStringFrom(person2).replace(". ",".<br>");
  if (alsoUpdateHTML){
    updateHTML();
  }  
}

window.addEventListener("resize", (event) => {ctx.canvas.width,ctx.canvas.height});

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

function reset(){
  mostRecentlyAssignedID = 0;
  people = [];
  roles = [];
  colouredConnectionTexts = {};
  spiderDiagramAvoidPeople = [];
  ALWAYS_SETTLE_FOR_VACANT = false;
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

  personA.innerHTML = "";
  personB.innerHTML = "";
  shortestPathAnswerText.innerHTML = "";

  if (people.length == 0){
    console.log("There are no people in the people array!")
    return;
  }

  let peopleInAlphabeticalOrder = [];

  people.forEach((person)=>{
    peopleInAlphabeticalOrder.push(person);
    if (person.myRoles.length > 0){ //just bandwagoning here to make sure all the role relations are added to the relevant people
      person.myRoles.forEach((role) => {
        getRoleByName(role).relations.forEach((roleRelation)=>{
          if (!roleRelation.roleRelationHasBeenProcessed){
            person.addRelation(roleRelation.getOtherPerson(),roleRelation.description,null,false,true)
            roleRelation.roleRelationHasBeenProcessed = true;
          }          
        })
      });
    }
  });

  peopleInAlphabeticalOrder.sort((a, b) => {return a.name.localeCompare(b.name);});

  peopleInAlphabeticalOrder.forEach((person) => {
    personA.appendChild(makePersonOptionFor(person))
    personB.appendChild(makePersonOptionFor(person))
  })
  autoCentre();
}

function autoCentre(){
  spiderDiagramAvoidPeople = [];
  let USE_MOST_IMMEDIATE_CONNECTIONS_INSTEAD = false; //makes for a good backup if you want it to render a bit faster

  let notification = document.body.appendChild(document.createElement("div"));
  notification.id="notification";

  notification.addEventListener("mousedown", (e) => {
    mousedownFunction(e);
  });
  
  notification.addEventListener("mousemove", (e) => {
    mouseMoveFunction(e);
  });
  
  notification.addEventListener("mouseup", (e) => {
    mouseUpFunction(e);
  });

  if (USE_MOST_IMMEDIATE_CONNECTIONS_INSTEAD){
    setCurrentFocalPerson(getPersonWithMostImmediateConnections())
    notification.innerHTML = "(Auto-centring on the point with the most immediate connections (<strong>"+currentFocalPerson.name +"</strong>)";
  } else {
    setCurrentFocalPerson(getPersonWithFewestLevels())
    notification.innerHTML = "(Auto-centring on most efficient centre point (<strong>"+currentFocalPerson.name +"</strong>)";
  }
  
  notification.className = "fadeout";
  notificationCooldown(notification);
}

async function notificationCooldown(notification){
  await new Promise(r => setTimeout(r, 6000));
  notification.remove();
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

  USE_COLOURED_CONNECTION_TEXTS = false;
  DRAW_ANGLED_NAME_TEXT = false;
  ALWAYS_SETTLE_FOR_VACANT = true;

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
        case "DRAW_ANGLED_NAME_TEXT":
          DRAW_ANGLED_NAME_TEXT = jsonSettings.DRAW_ANGLED_NAME_TEXT;
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
  if (p.id > mostRecentlyAssignedID){
    mostRecentlyAssignedID = p.id;
  }
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
                            ALWAYS_SETTLE_FOR_VACANT:ALWAYS_SETTLE_FOR_VACANT,
                            DRAW_ANGLED_NAME_TEXT:DRAW_ANGLED_NAME_TEXT};

  return JSON.stringify(output);
}

function updateHTML(){
    let app = document.getElementById("app");
    app.innerHTML = "";
    app.appendChild(currentFocalPerson.getAnchorTag());
    app.appendChild(currentFocalPerson.getRelationsDiv());
    personConnectionDropdownChanged(false);
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
    otherPerson.unhighlightRelations();

    let level = currentFocalPerson.getDegreesOfSeparationFrom(otherPerson, spiderDiagramAvoidPeople, false, true).degrees;

	  if (level == undefined){
      otherPerson.positionOnSpiderDiagram = [0,0]
      otherPerson.updateConnectionLinePositions(null);
      if (MONITOR_NODES_THAT_COULD_NOT_BE_REACHED){
        couldNotBeReached.push(otherPerson);
      }
      return;
	  }

    if (spiderDiagramAvoidPeople.includes(otherPerson)){
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
    
	let otherPersonAndWebContext = {p:otherPerson, degreesFromFocalPerson: level, isAddedToWeb:false, prevPersonInWeb:null, hasBeenEvaluated:false};
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

    let slotCount = getNumberOfSlotsAtLevel(slotsAtEachLevel, L);
    let spider_diagram_arm_length = L * 400;
  
    let angle_diff = 360 / slotCount;

    for (let i = 0; i < slotCount; i++){
        let angle_in_rads = deg2rad(90 + (angle_diff * i));
        let armXLength = (Math.sin(angle_in_rads) * spider_diagram_arm_length);
        let armYLength = (Math.cos(angle_in_rads) * spider_diagram_arm_length);
        let newSlot = {
          slotNumber: i,
          position: [currentFocalPerson.positionOnSpiderDiagram[0] + armXLength, currentFocalPerson.positionOnSpiderDiagram[1] + armYLength],
          occupant: null,
          distOfOccupantToPrev: 999999999
          };
        slots.push(newSlot);
    }

    let prevOfLastProcessedPersonWebContext = null;
    
    for (let i = 0; i < peopleWebContexts.length; i++){
      let personWebContext = peopleWebContexts[i];

      if (personWebContext.degreesFromFocalPerson == L){        
        if (personWebContext.prevPersonInWeb != null && prevOfLastProcessedPersonWebContext != personWebContext.prevPersonInWeb){ //try and process children of a common parent node in sequence
          let cont = true;
          //console.log("considering an array position swap!")
          peopleWebContexts.forEach((potentialPersonWebContext, potentialIndex) => {
            if (potentialPersonWebContext.degreesFromFocalPerson == L && !potentialPersonWebContext.hasBeenEvaluated){
              if (!cont){
                return;
              }
              if (prevOfLastProcessedPersonWebContext != null && potentialPersonWebContext.prevPersonInWeb == prevOfLastProcessedPersonWebContext){
                let temp = personWebContext;
                peopleWebContexts[i] = potentialPersonWebContext;
                personWebContext = potentialPersonWebContext;
                peopleWebContexts[potentialIndex] = temp;
                //console.log("Performing a swap in array position between "+temp.p.name+" and "+personWebContext.p.name+" to make sure that children of the same parent are processed together!")
                cont = false;
              }
            }
          });
        }

        if (personWebContext.prevPersonInWeb == null){ //then this is the root person and they get special treatment!
          personWebContext.p.positionOnSpiderDiagram = [canvas.width/2, canvas.height/2];
        }

        personWebContext.isAddedToWeb = true;

        personWebContext.p.relations.forEach((relation) => {
          if (spiderDiagramAvoidRelationText.includes(relation.description)){
            return;
          }
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

        findBestSlot(personWebContext,slots, L, slotsAtEachLevel);
        prevOfLastProcessedPersonWebContext = personWebContext.prevPersonInWeb;
        personWebContext.hasBeenEvaluated = true;
        }        
    }
  }
}

function getNumberOfSlotsAtLevel(slotsAtEachLevel, L){
  return Object.keys(slotsAtEachLevel).includes((L)+"") ? (slotsAtEachLevel[L] * (L >= 2 ? Math.round(L*1.5) : 1)) : 1
}

function getSlotNumberAsProportion(slot,L,slotsAtEachLevel){
  return slot.slotNumber / getNumberOfSlotsAtLevel(slotsAtEachLevel, L);
}

function findBestSlot(personWebContext,slots, L, slotsAtEachLevel){
  //find the next closest available slot in this level's ring, and put this person node at the location of that slot

  let chosenSlot = slots[0];

  if (personWebContext.prevPersonInWeb != null){
    let smallestDiff = 9999999999;
    let closestVacantSlot = null;

    slots.forEach((slot)=>{            
        personWebContext.p.positionOnSpiderDiagram = slot.position; //we temporarily move our candidate to the occupied slot so that we can check the distance etc
        let thisProportion = getSlotNumberAsProportion(slot,L,slotsAtEachLevel);
        let prevProportion = getSlotNumberAsProportion(personWebContext.prevPersonInWeb.slot,parseInt(L)-1,slotsAtEachLevel);
        let diff = Math.abs(thisProportion - prevProportion);
        if (diff > 0.5){
          diff = Math.abs(diff-1);
        }
        if (slot.occupant == null && diff <= smallestDiff){ //set the closest dist for a slot that isn't occupied (a good enough slot if the occupant of our preferred slot turns out to have a better claim to it)
          smallestDiff = diff;
          closestVacantSlot = slot;
        }
    });
    personWebContext.p.positionOnSpiderDiagram = closestVacantSlot.position;
    closestVacantSlot.occupant = personWebContext;
    chosenSlot = closestVacantSlot;
  }
  personWebContext.p.updateConnectionLinePositions(personWebContext.prevPersonInWeb,chosenSlot);
}

function getAngleDifferenceToPrev(personWebContext){
  if (personWebContext.prevPersonInWeb == null){
    return 0;
  }
  if (personWebContext.prevPersonInWeb.connectionTextAngle == null){
    return Math.abs(personWebContext.p.connectionTextAngle);
  }
  else {
    personWebContext.p.updateConnectionLinePositions(personWebContext.prevPersonInWeb,"dontUpdate");
    return Math.abs(personWebContext.p.connectionTextAngle - personWebContext.prevPersonInWeb.connectionTextAngle);
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
  let fewestPersonValidImmediateRelationsCount = 0;

  people.forEach((person) => {
    if (spiderDiagramAvoidPeople.includes(person)){
      return;
    }

    let validRelations = [];

    person.relations.forEach((relation) => {
      if (!spiderDiagramAvoidPeople.includes(relation.getOtherPerson())){
        validRelations.push(relation)
      }
    });

    if (validRelations.length > 1){
      
      let maxLevelWithThisPersonAtCentre = person.getDegreesOfSeparationFrom(null, spiderDiagramAvoidPeople, true, true).degrees;

      if (maxLevelWithThisPersonAtCentre != 0 && maxLevelWithThisPersonAtCentre <= fewest){
        if (maxLevelWithThisPersonAtCentre == fewest){
          if (validRelations.length > fewestPersonValidImmediateRelationsCount){ //if we find ourselves tying with another person with an equally low number of levels, decide which one takes precedent by how many immediate connections it has (more = better, because it spreads the nodes out)
            fewest = maxLevelWithThisPersonAtCentre;
            fewestPerson = person;
            fewestPersonValidImmediateRelationsCount = validRelations.length;
          }
        } else {
          fewest = maxLevelWithThisPersonAtCentre;
          fewestPerson = person;
          fewestPersonValidImmediateRelationsCount = validRelations.length;
        }
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

function drawTextToCanvas(ctx, position, angle, text){
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.save();
  ctx.translate(canvasPanX + position[0], canvasPanY + position[1]);

  if (angle >= Math.PI || angle < 0){
    ctx.rotate(-angle - 1.5708);
  } else {
    ctx.rotate(-angle + 1.5708);
  }

  if (text != null){
    ctx.fillText(text,0,0);  
  }
    
  ctx.restore(); 
}

function takeScreenshot(){
  let maxExtentX = -999999999;
  let maxExtentY = -999999999;
  let minExtentX = 999999999;
  let minExtentY = 999999999;

  people.forEach((person) => {
    let x = person.positionOnSpiderDiagram[0];
    let y = person.positionOnSpiderDiagram[1]
    if (x < minExtentX){
      minExtentX = x;
    }
    if (x > maxExtentX){
      maxExtentX = x;    
    }
    if (y < minExtentY){
      minExtentY = y;
    }
    if (y > maxExtentY){
      maxExtentY = y;
    }
  });

  let width = maxExtentX - minExtentX;
  let height = maxExtentY - minExtentY;

  ctx.canvas.width = width*1.25;
  ctx.canvas.height = height*1.25;

  canvasPanX = ctx.canvas.width/10;
  canvasPanY = ctx.canvas.height/4;

  updateHTML();

  downloadImageAnchorTag.href = ctx.canvas.toDataURL();
  downloadImageAnchorTag.target = "_blank";
  downloadImageAnchorTag.click();
}

class Role {
  constructor(name){
    this.name = name;
    this.relations = [];
  }

  addRelation(otherThing,description,reverseDescription,createReverseRelationNow){
    let r = new Relation(this,otherThing,description);
    this.relations.push(r);    
    if (createReverseRelationNow){
      let reverseR = new Relation(otherThing,this,reverseDescription);
      otherThing.relations.push(reverseR);
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
      this.prevInVisualWeb = null;
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

  unhighlightRelations(){
    this.relations.forEach((relation) => {
      relation.highlighted = false;
    });
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
      if (spiderDiagramAvoidPeople.includes(relation.getOtherPerson())){
        return;
      }
      let li = document.createElement("li");
      let a = document.createElement("a");
      a.innerHTML = relation.description + " <strong>" + (relation.getOtherPerson() == this ? "themselves" : relation.getOtherPerson().name) + "</strong>";
      a.onclick = () => {setCurrentFocalPerson(relation.getOtherPerson())};
      li.appendChild(a);
      ul.appendChild(li);
    });
    return ul;
  }

  getImmediateRelationshipTo(otherPerson){
    for (let i = 0; i < this.relations.length; i++) {
      let relation = this.relations[i];
      if (relation.getOtherPerson() == otherPerson){
          return relation;   
        }
    };
    return null;
  }

  getImmediateRelationshipTextTo(otherPerson, highlighted){
    let text = "is not immediately related to";

    this.relations.forEach((relation) => {
      if (relation.getOtherPerson() == otherPerson)
        {
          text = relation.description;
          if (highlighted != null && highlighted){
            relation.highlighted = true;
          }          
        }
    });

    return text;
  }

  updateConnectionLinePositions(prevPerson,chosenSlot){
    let armXLength = 0;
    let armYLength = 0;

    if (chosenSlot != "dontUpdate"){
      this.slot = chosenSlot;  
    }
    
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
        this.connectionTextWithPrevOnVisualWeb = prevPerson.getImmediateRelationshipTextTo(this,false); //these two have temporarily, or maybe permanently, been made the same, because it flows better now that the web is concentric
      }  else {
        this.connectionTextWithPrevOnVisualWeb = prevPerson.getImmediateRelationshipTextTo(this,false);
      }                                  

      this.prevInVisualWeb = prevPerson;

      let hypotenuse = getDistanceBetween([0,0],[armXLength,armYLength]);
      
      if (armXLength < 0){
        this.connectionTextAngle = -Math.acos(armYLength/hypotenuse);
      } else {
        this.connectionTextAngle = Math.acos(armYLength/hypotenuse);
      }
    } else {
      this.connectionTextWithPrevOnVisualWeb = null;
      this.connectionTextAngle = Math.PI/2;
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

    drawTextToCanvas(ctx, this.positionOnSpiderDiagram, DRAW_ANGLED_NAME_TEXT ? this.connectionTextAngle : Math.PI/2, this.name);

    if (this.connectionTextWithPrevOnVisualWeb != null){
      // Draw connection line with previous node:
      ctx.beginPath(); 

      if (this.prevInVisualWeb != null && this.getImmediateRelationshipTo(this.prevInVisualWeb).highlighted){
        ctx.strokeStyle = "rgba(255,255,0,0.4)"; 
        ctx.lineWidth = 3; 
      } else {
        ctx.strokeStyle = "rgba(128,128,128,0.3)"; 
        ctx.lineWidth = 1; 
      }

      ctx.moveTo(canvasPanX+this.connectionLineStart[0], canvasPanY+this.connectionLineStart[1]);
      ctx.lineTo(canvasPanX+this.connectionLineEnd[0], canvasPanY+this.connectionLineEnd[1]);
      ctx.stroke();

      // Draw connection description over connection line:
   
	  if (USE_COLOURED_CONNECTION_TEXTS && Object.keys(colouredConnectionTexts).includes(this.connectionTextWithPrevOnVisualWeb.toLowerCase())){
		  ctx.fillStyle = colouredConnectionTexts[this.connectionTextWithPrevOnVisualWeb.toLowerCase()];
	  } else {
		  ctx.fillStyle = "rgba(255,255,255,0.75)";  
	  }    
      ctx.font = "12px Arial";
      drawTextToCanvas(ctx, this.connectionTextPosition, this.connectionTextAngle, this.connectionTextWithPrevOnVisualWeb)
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
    let reportString = this.getDegreesOfSeparationFrom(targetPerson,avoidPeople,false,false).report;
	if (avoidPeople != null && avoidPeople.length > 0){
		reportString += getAvoidingText(avoidPeople);
	}
	 return reportString;
  }

  getDegreesOfSeparationFrom(targetPerson, avoidPeople, getMaxExtentOfWebInstead, numberOnly){
    
    if (targetPerson == this){
      if (numberOnly){
        return {degrees:0,report:null};
      } else {
        return {degrees:0,report: targetPerson.name+" and "+targetPerson.name+" are the same person, so the degrees of separation are 0."};
      }      
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
          if (spiderDiagramAvoidRelationText.includes(relation.description)){
            return;
          } else if (!Object.keys(peopleAndCounts).includes(relation.getOtherPersonId()+"") && !avoidPeople.includes(relation.getOtherPerson())){
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
      return {degrees: maxLevelEncountered, report:"The 'degrees' variable of this object is showing the max extent of web, as requested."};
    }

    let reportString = this.name + " is " + peopleAndCounts[targetPerson.id] + " degree"+( peopleAndCounts[targetPerson.id] == 1 ? "" : "s")+" away from " + targetPerson.name+". ";

    if (targetFound){
      if (numberOnly){
        return {degrees: peopleAndCounts[targetPerson.id], report:null}
      }
      let curPerson = targetPerson;
      let prev = peopleAndPrevPeople[targetPerson.id];
      
      let firstLoop = true;

        while (prev != null) {
          reportString += curPerson.name + (firstLoop ? " " : ", who ") + curPerson.getImmediateRelationshipTextTo(prev,true);
          prev.getImmediateRelationshipTo(curPerson).highlighted = true;

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

    return {degrees: peopleAndCounts[targetPerson.id], report:reportString};
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
    this.roleRelationHasBeenProcessed = false;  //if this is a role relation, this is whether or not it's already been transformed into autogenerated person relations (so that we don't do it more than once!)
    this.isAutogeneratedFromRoleRelation = false; //whether this role is an autogenerated relation between people, based on their roles
    this.highlighted = false;

    if (type == null){
      this.type == "PP";
    }

    if (this.firstThing instanceof Person){
      this.type += "P";
    } else {
      this.type += "R";
      this.roleRelationHasBeenProcessed = false;
    }

    if (this.otherThing instanceof Person){
      this.type += "P";
    } else {
      this.type += "R";
      this.roleRelationHasBeenProcessed = false;
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

function makePersonOptionFor(person){
  let newOption = document.createElement("option");
  newOption.id = "option-for-person-with-id-"+person.id;
  newOption.innerHTML = person.name;
  return newOption;
}

function addTempMapViaCode(){
  reset();

  // * START OF MODIFIABLE SECTION *
  //put addPerson() statements here

  addPerson("Luke Skywalker");
  addPerson("Leia Organa");
  addPerson("Anakin Skywalker");
  addPerson("Padme Amidala");
  addPerson("Shmi Skywalker");
  addPerson("Sheev Palpatine");
  addPerson("Obi-Wan Kenobi");
  addPerson("Qui-gon Jinn");
  addPerson("Count Dooku");
  addPerson("Yoda");
  addPerson("Darth Maul");
  addPerson("Rey");
  addPerson("Han Solo");
  addPerson("Chewbacca");
  addPerson("Jabba the Hutt");
  addPerson("the Clones");
  addPerson("Jango Fett");
  addPerson("Boba Fett");

  //put getPerson().addRelation() statements here:
  
  getPerson("Anakin Skywalker").addRelation(getPerson("Shmi Skywalker"),"is the son of","is the mother of",true);
  getPerson("Luke Skywalker").addRelation(getPerson("Anakin Skywalker"),"is the son of","is the father of",true);
  getPerson("Luke Skywalker").addRelation(getPerson("Padme Amidala"),"is the son of","is the mother of",true);
  getPerson("Leia Organa").addRelation(getPerson("Anakin Skywalker"),"is the daughter of","is the father of",true);
  getPerson("Leia Organa").addRelation(getPerson("Padme Amidala"),"is the daughter of","is the mother of",true);
  getPerson("Leia Organa").addRelation(getPerson("Luke Skywalker"),"is the sister of","is the brother of",true);
  getPerson("Han Solo").addRelation(getPerson("Leia Organa"),"loved","loved",true);
  getPerson("Han Solo").addRelation(getPerson("Jabba the Hutt"),"works for","employed",true);
  getPerson("Chewbacca").addRelation(getPerson("Han Solo"),"is friends with","is friends with",true);
  getPerson("Padme Amidala").addRelation(getPerson("Anakin Skywalker"),"is the lover of","is the lover of",true);
  getPerson("Anakin Skywalker").addRelation(getPerson("Obi-Wan Kenobi"),"was trained by","trained",true);
  getPerson("Obi-Wan Kenobi").addRelation(getPerson("Qui-gon Jinn"),"was trained by","trained",true);
  getPerson("Qui-gon Jinn").addRelation(getPerson("Count Dooku"),"was trained by","trained",true);
  getPerson("Count Dooku").addRelation(getPerson("Yoda"),"was trained by","trained",true);
  getPerson("Anakin Skywalker").addRelation(getPerson("Sheev Palpatine"),"was sith apprentice to","was Sith master to",true);
  getPerson("Darth Maul").addRelation(getPerson("Sheev Palpatine"),"was sith apprentice to","was Sith master to",true);
  getPerson("Count Dooku").addRelation(getPerson("Sheev Palpatine"),"was sith apprentice to","was Sith master to",true);
  getPerson("Luke Skywalker").addRelation(getPerson("Yoda"),"was trained by","trained",true);
  getPerson("Rey").addRelation(getPerson("Luke Skywalker"),"was trained by","trained",true);
  getPerson("Rey").addRelation(getPerson("Sheev Palpatine"),"is the granddaughter of","is the grandfather of",true);
  getPerson("Boba Fett").addRelation(getPerson("Jango Fett"),"is a clone of","was cloned to create",true);
  getPerson("the Clones").addRelation(getPerson("Sheev Palpatine"),"were commissioned by","commissioned the creation of",true);
  getPerson("the Clones").addRelation(getPerson("Jango Fett"),"are clones of","was cloned to create",true);
  getPerson("Anakin Skywalker").addRelation(getPerson("the Clones"),"fought alongside","fought alongside",true);
  getPerson("Obi-Wan Kenobi").addRelation(getPerson("the Clones"),"fought alongside","fought alongside",true);

  // * END OF MODIFIABLE SECTION *

  setupAfterLoad();
  console.log(getAllAsJSON());
}

dropdown.appendChild(makeOptionFor(vampire, "Vampire"));
dropdown.appendChild(makeOptionFor(majora, "Zelda Majora's Mask"));
dropdown.appendChild(makeOptionFor(hamlet, "Hamlet"));

reset();
dropdown.children[0].click();

addTempMapViaCode();