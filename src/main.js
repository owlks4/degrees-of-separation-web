import './style.css'
import majora from './majora.json'

let people = [];
let mostRecentlyAssignedID = 0;
let currentFocalPerson = null;
let spiderDiagramAvoidPeople = [];

let canvas = document.getElementById("canvas");

let ctx = canvas.getContext("2d");
ctx.canvas.width  = window.innerWidth;
ctx.canvas.height = window.innerHeight;
let canvasPanX = -window.innerWidth/7;
let canvasPanY = -window.innerHeight/14;

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
        canvasPanX -= 20;
        updateHTML();
    break;
  }
});

let oldMousePos = null;

canvas.addEventListener("mousedown", (e) => {
  oldMousePos = [e.screenX, e.screenY];  
});

canvas.addEventListener("mousemove", (e) => {
  if (oldMousePos != null){
      canvasPanX += (e.screenX - oldMousePos[0]);
      canvasPanY += (e.screenY - oldMousePos[1]);
      oldMousePos = [e.screenX, e.screenY];      
      updateHTML();
  }
});

canvas.addEventListener("mouseup", (e) => {
  oldMousePos = null;
});

function resetPeople(){
  mostRecentlyAssignedID = 0;
  people = [];
}

function setCurrentFocalPerson(p){
  currentFocalPerson = p;
  recalculateSpiderDiagram();
  updateHTML();
}

function loadAllFromJsonString(jsonString){
  loadAllFromJson(JSON.parse(jsonString));
}

function loadAllFromJson(obj){
  people = [];

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

function getAllAsJSON(){
  let output = [];

  people.forEach((person) => {
    output.push(person.getAsObjectForJSON());
  })

  return JSON.stringify(output);
}

function makePersonFromJSONPerson(jsonPersonObj){
  let p = new Person();
  p.id = jsonPersonObj.id;
  p.name = jsonPersonObj.name;  
  p.relations = []; //this gets filled later on, in the function that calls this method
  return p;
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

  people.forEach((otherPerson) => {
    let level = currentFocalPerson.getDegreesOfSeparationFrom(otherPerson, []);
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
            if (otherPersonWebCtx.p == relation.otherPerson){ //if the other person in this relationship is already added to the web, don't add them again. The return returns the forEach iteration in the relations array, not the wider function.
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

          let ALWAYS_SETTLE_FOR_VACANT = true;

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

function getPersonWithMostConnections(){
  let highest = people[0];

  people.forEach((person) => {
    if (person.relations.length > highest.relations.length){
      highest = person;
    }
  });

  return highest;
}

function getNextID(){
  return mostRecentlyAssignedID++;
}

function addPerson(name){
  people.push(new Person(name));
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
  }

  addRelation(otherPerson,description,reverseDescription,createReverseRelationNow){
    this.relations.push(new Relation(this,otherPerson,description));
    if (createReverseRelationNow){
      otherPerson.relations.push(new Relation(otherPerson,this,reverseDescription));
    }
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
      a.innerHTML = relation.description + " <strong>" + (relation.otherPerson == this ? "themselves" : relation.otherPerson.name) + "</strong>";
      a.onclick = () => {setCurrentFocalPerson(relation.otherPerson)};
      li.appendChild(a);
      ul.appendChild(li);
    });
    return ul;
  }

  getImmediateRelationshipTextTo(otherPerson){
    let text = "is not immediately related to";

    this.relations.forEach((relation) => {
      if (relation.otherPerson == otherPerson)
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
      
      this.connectionTextAngle = Math.atan(armXLength,armYLength);
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
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.save();
      ctx.translate(canvasPanX + this.connectionTextPosition[0], canvasPanY + this.connectionTextPosition[1]);

      let angle = this.connectionTextAngle;

      while (angle > Math.PI){
        angle -= (Math.PI * 2);
      }

      while (angle < -Math.PI){
        angle += (Math.PI * 2);
      }

      //if (angle >= Math.PI || angle < 0){
      //  ctx.rotate(-angle - 1.5708);
      //} else {
      //  ctx.rotate(-angle + 1.5708);
      //}

      if (this.connectionTextWithPrevOnVisualWeb != null){
        ctx.fillText(this.connectionTextWithPrevOnVisualWeb,0,0);  
      }
        
      ctx.restore();   
    }
  }

  getAsObjectForJSON(){
    let JSONfriendlyRelations = Array(this.relations.length);
    for (let i = 0; i < this.relations.length; i++){
      JSONfriendlyRelations[i] = this.relations[i].getJSONFriendlyVersion();
    }
    return {name: this.name, id:this.id, relations:JSONfriendlyRelations};
  }

  getDegreesOfSeparationFrom(targetPerson, avoidPeople){
    
    if (targetPerson == this){
      return 0;
    }

    if (avoidPeople == null){
      avoidPeople = [];
    } else {
      for (let i = 0; i < avoidPeople.length; i++){
        avoidPeople[i] = avoidPeople[i].id;
      }
    }

    let peopleAndCounts = {};
    let peopleAndPrevPeople = {};

    let alreadyProcessedPeople = [];

    peopleAndCounts[this.id] = 0;
    peopleAndPrevPeople[this.id] = null;

    let targetFound = false;

    let DEBUG_LOOPS_LIMIT = 5000;
    let DEBUG_LOOPS_COUNT = 0;

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
            if (!Object.keys(peopleAndCounts).includes(relation.otherPerson.id+"") && !avoidPeople.includes(relation.otherPerson.id)){
              peopleAndCounts[relation.otherPerson.id] = lowest + 1; //set the score for the next person we're going to expand
              peopleAndPrevPeople[relation.otherPerson.id] = getPersonById(lowest_person); //set the prev person

              if (relation.otherPerson == targetPerson){
                targetFound = true;
              }
            }
        })

        DEBUG_LOOPS_COUNT++;
    }

    let reportString = this.name + " is " + peopleAndCounts[targetPerson.id] + " degrees away from " + targetPerson.name+".";

    if (avoidPeople.length > 0){
      reportString += getAvoidingText(avoidPeople);
    }
    
    reportString +="\n";

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
      if (avoidPeople.length > 0){
        reportString += getAvoidingText(avoidPeople);
      }
    }

    return peopleAndCounts[targetPerson.id];
  }
}

function getAvoidingText(avoidPeople){
  let text = "";
  if (avoidPeople.length > 0){
    text += " (Avoiding: "
    avoidPeople.forEach((personId) => {
      text += getPersonById(personId).name + " ";
    })  
    text +=")";
  }
  return text;
}

class Relation {
  constructor(person, otherPerson, description){
    this.person = person;
    this.otherPerson = otherPerson;
    this.description = description;    
  } 

  getJSONFriendlyVersion(){
    return {personId:this.person.id, otherPersonId:this.otherPerson.id, description:this.description};
  }
}

addPerson("Hamlet")
addPerson("King Claudius")
addPerson("Polonius")
addPerson("Horatio")
addPerson("Laertes")
addPerson("Lucianus")
addPerson("Voltimand")
addPerson("Cornelius")
addPerson("Rosencrantz")
addPerson("Guildenstern")
addPerson("Osric")
addPerson("Gentleman")
addPerson("Priest")
addPerson("Marcellus")
addPerson("Bernardo")
addPerson("Francisco")
addPerson("Reynaldo")
addPerson("Players")
addPerson("Clowns")
addPerson("Fortinbras")
addPerson("Captain")
addPerson("English Ambassadors")
addPerson("Queen Gertrude")
addPerson("Ophelia")
addPerson("King Hamlet")
addPerson("Old King Fortinbras")
addPerson("Yorick")

getPerson("Hamlet").addRelation(getPerson("King Claudius"),"despises","is despised by",true);
getPerson("Hamlet").addRelation(getPerson("Horatio"),"is friends with","is friends with",true);
getPerson("Hamlet").addRelation(getPerson("Polonius"),"mortally wounds","is stabbed through a curtain by",true);
getPerson("Hamlet").addRelation(getPerson("Laertes"),"duels","duels",true);
getPerson("Hamlet").addRelation(getPerson("Queen Gertrude"),"is the son of","is the mother of",true);
getPerson("Hamlet").addRelation(getPerson("King Hamlet"),"is the son of","was the father of",true);
getPerson("Queen Gertrude").addRelation(getPerson("King Claudius"),"is the wife of","is husband to",true);
getPerson("Queen Gertrude").addRelation(getPerson("King Hamlet"),"was the wife of","was husband to",true);
getPerson("Old King Fortinbras").addRelation(getPerson("King Hamlet"),"was defeated by","once defeated",true);
getPerson("Ophelia").addRelation(getPerson("Hamlet"),"is potentially in love with","is potentially in love with",true);
getPerson("Ophelia").addRelation(getPerson("Polonius"),"is the daughter of","is the father of",true);
getPerson("Laertes").addRelation(getPerson("Polonius"),"is the daughter of","is the father of",true);
getPerson("Laertes").addRelation(getPerson("Ophelia"),"is the brother of","is sister to",true);
getPerson("Osric").addRelation(getPerson("Laertes"),"oversees a duel for","participates in a duel overseen by",true);
getPerson("Osric").addRelation(getPerson("Hamlet"),"oversees a duel for","participates in a duel overseen by",true);
getPerson("Francisco").addRelation(getPerson("Marcellus"),"guards Elsinore alongside","guards Elsinore alongside",true);
getPerson("Francisco").addRelation(getPerson("Bernardo"),"guards Elsinore alongside","guards Elsinore alongside",true);
getPerson("Marcellus").addRelation(getPerson("Bernardo"),"guards Elsinore alongside","guards Elsinore alongside",true);
getPerson("Marcellus").addRelation(getPerson("King Hamlet"),"sees a ghost resembling","is seen roaming the battlements by",true);
getPerson("Bernardo").addRelation(getPerson("King Hamlet"),"sees a ghost resembling","is seen roaming the battlements by",true);
getPerson("Marcellus").addRelation(getPerson("Horatio"),"brings ghost-related information to","is told about a ghost on the battlements by",true);
getPerson("Marcellus").addRelation(getPerson("Hamlet"),"brings ghost-related information to","is told about his father's ghost by",true);
getPerson("Gentleman").addRelation(getPerson("Ophelia"),"witnesses madness in","exhibits madness in the presence of",true);
getPerson("Gentleman").addRelation(getPerson("Queen Gertrude"),"speaks of Ophelia's madness to","is told about Ophelia's madness by",true);
getPerson("Rosencrantz").addRelation(getPerson("Hamlet"),"is a childhood friend of","is a childhood friend of",true);
getPerson("Guildenstern").addRelation(getPerson("Hamlet"),"is a childhood friend of","is a childhood friend of",true);
getPerson("Rosencrantz").addRelation(getPerson("King Claudius"),"is secretly working for","is secretly employing",true);
getPerson("Guildenstern").addRelation(getPerson("King Claudius"),"is secretly working for","is secretly employing",true);
getPerson("Fortinbras").addRelation(getPerson("Old King Fortinbras"),"is the son of","was the father of",true);
getPerson("Fortinbras").addRelation(getPerson("Hamlet"),"assumes the throne of Denmark after the death of","loses the throne of Denmark to",true);
getPerson("Reynaldo").addRelation(getPerson("Polonius"),"is instructed to spy on Laertes by","entrusts a spying mission to",true);
getPerson("Reynaldo").addRelation(getPerson("Laertes"),"spies on Laertes","is spied on by",true);
getPerson("Players").addRelation(getPerson("Hamlet"),"perform a modified play devised by","devises a modified play to be performed by the",true);
getPerson("Players").addRelation(getPerson("King Claudius"),"inadvertently spook","is shocked at seeing his crime re-enacted by the",true);
getPerson("Yorick").addRelation(getPerson("Hamlet"),"has his skull spoken to by","regrets the death of",true);
getPerson("Clowns").addRelation(getPerson("Ophelia"),"dig a grave for","is buried by the",true);
getPerson("Clowns").addRelation(getPerson("Hamlet"),"trade witticisms with","trades witticisms with the",true);
getPerson("English Ambassadors").addRelation(getPerson("Rosencrantz"),"report the death of","is reported dead by",true);
getPerson("English Ambassadors").addRelation(getPerson("Guildenstern"),"report the death of","is reported dead by",true);

resetPeople();

addPerson("Prince Lady el Diablo")
addPerson("Lady Carrington"),

addPerson("Axel Warden"),
addPerson("Henry Passmore"),
addPerson("Nollaig Archemboult"),

addPerson("Keir of Haworth"),
addPerson("Viceroy Mircalla Lee"),
addPerson("Ebony Webb"),
addPerson("Cora Gettins"),
addPerson("Maya Thornstep"),
addPerson("Backbone"),
addPerson("Celda Themis"),
addPerson("Jane Bodkin Adams"),
addPerson("Isadora Jones"),

addPerson("Zoey Walker"),
addPerson("Pete"),
addPerson("Christopher Demott"),
addPerson("Levi Rose"),
addPerson("Willow Warneford"),
addPerson("Kai Smith"),
addPerson("Chester Willard"),
addPerson("Lord Marcae"),
addPerson("Barty Crane"),

addPerson("Oswald Numeon"),
addPerson("Robert Whyteside"),
addPerson("Gwenyth Meredith"),
addPerson("Isaac Sterling"),

addPerson("Stargazer Fairfax"),
addPerson("Theodore James"),
addPerson("Lykofron"),
addPerson("Mr Hawthorn"),
addPerson("Father Ward"),
addPerson("Alice Maddocks"),

addPerson("Orpheus Renwick"),
addPerson("Skitter"),
addPerson("Agis IV"),
addPerson("Nyk Mekhane"),
addPerson("Mr Streed"),
addPerson("Pine"),

addPerson("Penrose"),
addPerson("Harley Edwards"),
addPerson("Lady Divinnia"),
addPerson("Lyrik"),
addPerson("Vivian Astor")
addPerson("Johann Stieber"),
addPerson("Lysander"),
addPerson("Tiddles McSweenie"),
addPerson("Ethel Cabbage"),

//Council
getPerson("Lady Carrington").addRelation(getPerson("Viceroy Mircalla Lee"),"Viceroy","Seneschal",true);
getPerson("Lady Carrington").addRelation(getPerson("Nollaig Archemboult"),"Dominar","Seneschal",true);
getPerson("Lady Carrington").addRelation(getPerson("Gwenyth Meredith"),"Bishop","Seneschal",true);
getPerson("Lady Carrington").addRelation(getPerson("Levi Rose"),"Ospite","Seneschal",true);
getPerson("Lady Carrington").addRelation(getPerson("Henry Passmore"),"Hierophant","Seneschal",true);
getPerson("Lady Carrington").addRelation(getPerson("Isaac Sterling"),"Obi","Seneschal",true);
getPerson("Lady Carrington").addRelation(getPerson("Ebony Webb"),"Convener","Seneschal",true);
getPerson("Lady Carrington").addRelation(getPerson("Theodore James"),"Alpha","Seneschal",true);
getPerson("Lady Carrington").addRelation(getPerson("Cora Gettins"),"Prefect","Seneschal",true);
getPerson("Lady Carrington").addRelation(getPerson("Mr Streed"),"Custodes","Seneschal",true);

//Court (defined below council so that council members with low court positions are registered as council members first (otherwise their clan/cov members won't stem from them in the right capacity!))
getPerson("Prince Lady el Diablo").addRelation(getPerson("Mr Hawthorn"),"Sheriff","Prince",true);
getPerson("Prince Lady el Diablo").addRelation(getPerson("Maya Thornstep"),"Harpy","Prince",true);
getPerson("Prince Lady el Diablo").addRelation(getPerson("Axel Warden"),"Master of Elysium","Prince",true);
getPerson("Prince Lady el Diablo").addRelation(getPerson("Skitter"),"Herald","Prince",true);
getPerson("Prince Lady el Diablo").addRelation(getPerson("Lady Carrington"),"Seneschal","Prince",true);
getPerson("Mr Hawthorn").addRelation(getPerson("Maya Thornstep"),"Hound","Prince",true);
getPerson("Axel Warden").addRelation(getPerson("Nyk Mekhane"),"Champion","Prince",true);

//Clan members

getPerson("Isaac Sterling").addRelation(getPerson("Oswald Numeon"),"Mekhet","Obi",true);
getPerson("Isaac Sterling").addRelation(getPerson("Robert Whyteside"),"Mekhet","Obi",true);
getPerson("Isaac Sterling").addRelation(getPerson("Gwenyth Meredith"),"Mekhet","Obi",true);
getPerson("Isaac Sterling").addRelation(getPerson("Isaac Sterling"),"Mekhet","Obi",true);

getPerson("Mr Streed").addRelation(getPerson("Orpheus Renwick"),"Nosferatu","Custodes",true);
getPerson("Mr Streed").addRelation(getPerson("Skitter"),"Nosferatu","Custodes",true);
getPerson("Mr Streed").addRelation(getPerson("Agis IV"),"Nosferatu","Custodes",true);
getPerson("Mr Streed").addRelation(getPerson("Nyk Mekhane"),"Nosferatu","Custodes",true);
getPerson("Mr Streed").addRelation(getPerson("Mr Streed"),"Nosferatu","Custodes",true);
getPerson("Mr Streed").addRelation(getPerson("Pine"),"Nosferatu","Custodes",true);

getPerson("Theodore James").addRelation(getPerson("Stargazer Fairfax"),"Gangrel","Alpha",true);
getPerson("Theodore James").addRelation(getPerson("Theodore James"),"Gangrel","Alpha",true);
getPerson("Theodore James").addRelation(getPerson("Lykofron"),"Gangrel","Alpha",true);
getPerson("Theodore James").addRelation(getPerson("Mr Hawthorn"),"Gangrel","Alpha",true);
getPerson("Theodore James").addRelation(getPerson("Father Ward"),"Gangrel","Alpha",true);
getPerson("Theodore James").addRelation(getPerson("Alice Maddocks"),"Gangrel","Alpha",true);
getPerson("Theodore James").addRelation(getPerson("Ethel Cabbage"),"Gangrel","Alpha",true);

getPerson("Levi Rose").addRelation(getPerson("Zoey Walker"),"Daeva","Ospite",true);
getPerson("Levi Rose").addRelation(getPerson("Pete"),"Daeva","Ospite",true);
getPerson("Levi Rose").addRelation(getPerson("Christopher Demott"),"Daeva","Ospite",true);
getPerson("Levi Rose").addRelation(getPerson("Levi Rose"),"Daeva","Ospite",true);
getPerson("Levi Rose").addRelation(getPerson("Willow Warneford"),"Daeva","Ospite",true);
getPerson("Levi Rose").addRelation(getPerson("Kai Smith"),"Daeva","Ospite",true);
getPerson("Levi Rose").addRelation(getPerson("Chester Willard"),"Daeva","Ospite",true);
getPerson("Levi Rose").addRelation(getPerson("Lord Marcae"),"Daeva","Ospite",true);
getPerson("Levi Rose").addRelation(getPerson("Barty Crane"),"Daeva","Ospite",true);
getPerson("Levi Rose").addRelation(getPerson("Axel Warden"),"Daeva","Ospite",true);

getPerson("Nollaig Archemboult").addRelation(getPerson("Keir of Haworth"),"Ventrue","Dominar",true);
getPerson("Nollaig Archemboult").addRelation(getPerson("Viceroy Mircalla Lee"),"Ventrue","Dominar",true);
getPerson("Nollaig Archemboult").addRelation(getPerson("Lady Carrington"),"Ventrue","Dominar",true);
getPerson("Nollaig Archemboult").addRelation(getPerson("Ebony Webb"),"Ventrue","Dominar",true);
getPerson("Nollaig Archemboult").addRelation(getPerson("Cora Gettins"),"Ventrue","Dominar",true);
getPerson("Nollaig Archemboult").addRelation(getPerson("Maya Thornstep"),"Ventrue","Dominar",true);
getPerson("Nollaig Archemboult").addRelation(getPerson("Backbone"),"Ventrue","Dominar",true);
getPerson("Nollaig Archemboult").addRelation(getPerson("Celda Themis"),"Ventrue","Dominar",true);
getPerson("Nollaig Archemboult").addRelation(getPerson("Jane Bodkin Adams"),"Ventrue","Dominar",true);
getPerson("Nollaig Archemboult").addRelation(getPerson("Isadora Jones"),"Ventrue","Dominar",true);
getPerson("Nollaig Archemboult").addRelation(getPerson("Nollaig Archemboult"),"Ventrue","Dominar",true);
getPerson("Nollaig Archemboult").addRelation(getPerson("Lady Carrington"),"Ventrue","Dominar",true);
getPerson("Nollaig Archemboult").addRelation(getPerson("Prince Lady el Diablo"),"Ventrue","Dominar",true);


//loadAllFromJson(majora);

spiderDiagramAvoidPeople = [];

setCurrentFocalPerson(getPersonById(1))

/*
people.forEach((person) => {
  people.forEach((otherPerson) => {
    console.log(person.getDegreesOfSeparationFrom(otherPerson, []));
  })
})
*/