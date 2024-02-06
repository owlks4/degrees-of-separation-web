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

function setCurrentFocalPerson(p){
  currentFocalPerson = p;
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
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    currentFocalPerson.positionOnSpiderDiagram = [canvas.width/2, canvas.height/2];
    currentFocalPerson.drawToCanvas();

    let peopleAlreadyInSpiderDiagram = [currentFocalPerson];

    spiderDiagramAvoidPeople.forEach((avoidPerson) => {
      peopleAlreadyInSpiderDiagram.push(avoidPerson);
    });

    addRelationsToSpiderDiagram(currentFocalPerson, peopleAlreadyInSpiderDiagram, 0, 0);
}

function addRelationsToSpiderDiagram(person, peopleAlreadyInSpiderDiagram, level, dir){
    level++;

    let relationsToInclude = [];

    person.relations.forEach((relation) => {
        if (!peopleAlreadyInSpiderDiagram.includes(relation.otherPerson) && relation.otherPerson != person){
          relationsToInclude.push(relation);
          peopleAlreadyInSpiderDiagram.push(relation.otherPerson);
        }
    });

    if (relationsToInclude.length == 0){
      return;
    }

    //generate the angles at which these will splay out from the centre (within a 90 degree arc opening towards the right, and a 90 degree arc opening towards the left)
    let angles = [];

    let spider_diagram_arm_length = 400;

    let angle_total_space_on_one_side = 90;
    let curAngle = null;
    let angleSpacing = null;

    if (relationsToInclude.length > 16) {
      angle_total_space_on_one_side = 4 * relationsToInclude.length;
    }

    if (relationsToInclude.length == 1){
      angles.push(dir == 0 ? 90 : dir);
    } else if (relationsToInclude.length > 1){
      if (dir == 0){  //if dir is 0, this is the first node, meaning it has no direction. So splay out on both sides 
        curAngle = 90 - (angle_total_space_on_one_side/2);
        angleSpacing = angle_total_space_on_one_side / (relationsToInclude.length / 2); 
      } else { //but if it does have a direction, splay out only around that direction.
        curAngle = dir - (angle_total_space_on_one_side/2);
        angleSpacing = angle_total_space_on_one_side / relationsToInclude.length; 
      }

      relationsToInclude.forEach(() => {
          angles.push(curAngle);
        if (dir == 0) {
          angles.push(-curAngle)
        }

        curAngle += angleSpacing;
      });
    }

    for (let i = 0; i < relationsToInclude.length; i++) {
      let relation = relationsToInclude[i];
      let relationPerson = relation.otherPerson;
      let angle = deg2rad(angles[i]);
      let armXLength = (Math.sin(angle) * spider_diagram_arm_length);
      let armYLength = (Math.cos(angle) * spider_diagram_arm_length);
      relationPerson.positionOnSpiderDiagram = [person.positionOnSpiderDiagram[0] + armXLength, person.positionOnSpiderDiagram[1] + armYLength];
      ctx.beginPath(); 
      ctx.strokeStyle = "rgba(128,128,128,0.3)";
      ctx.moveTo(canvasPanX + person.positionOnSpiderDiagram[0] + (armXLength/15), canvasPanY + person.positionOnSpiderDiagram[1] + (armYLength/15));
      ctx.lineTo(canvasPanX + person.positionOnSpiderDiagram[0] + (armXLength * 9/10), canvasPanY + person.positionOnSpiderDiagram[1] + (armYLength * 9/10));
      ctx.stroke();
      ctx.font = "12px Arial";
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.save();
      ctx.translate((canvasPanX + person.positionOnSpiderDiagram[0] + (armXLength / 2)),(canvasPanY + person.positionOnSpiderDiagram[1] + (armYLength / 2)));
      
      while (angle > Math.PI){
        angle -= (Math.PI * 2);
      }

      while (angle < -Math.PI){
        angle += (Math.PI * 2);
      }

      if (angle >= Math.PI || angle < 0){
        ctx.rotate(-angle - 1.5708);
        ctx.fillText(relationPerson.getImmediateRelationshipTextTo(person),0,0);
      } else {
        ctx.rotate(-angle + 1.5708);
        ctx.fillText(relation.description,0,0);
      }

      ctx.restore();            
      relationPerson.drawToCanvas();
    };

    for (let i = 0; i < relationsToInclude.length; i++) {
      console.log("Hmm... this method of evaluating the tree diagram specifically isn't breadth-first! The normal dijkstra works correctly... but in the case of this tree diagram, it needs to make sure it's unfurled in ascending order of level from the centre...")
        addRelationsToSpiderDiagram(relationsToInclude[i].otherPerson, peopleAlreadyInSpiderDiagram, level, angles[i]);  
    }
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

  drawToCanvas(){
    ctx.beginPath();
    ctx.arc(canvasPanX + this.positionOnSpiderDiagram[0], canvasPanY + this.positionOnSpiderDiagram[1], 50, 0, 2 * Math.PI);
    ctx.fillStyle = "black";
    //ctx.stroke(); 
    //ctx.fill();
    ctx.font = "20px Arial";
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.name, canvasPanX + this.positionOnSpiderDiagram[0], canvasPanY + this.positionOnSpiderDiagram[1]);
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
      return this.name + " is 0 degrees away from "+targetPerson.name;
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

    return reportString;
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

//loadAllFromJson(majora);

spiderDiagramAvoidPeople = [getPersonWithMostConnections()];

setCurrentFocalPerson(getPersonById(0))

/*
people.forEach((person) => {
  people.forEach((otherPerson) => {
    console.log(person.getDegreesOfSeparationFrom(otherPerson, []));
  })
})
*/