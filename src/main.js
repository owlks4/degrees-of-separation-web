import majora from './majora.json';
import vampire from './vampire.json';
import hamlet from './hamlet.json';
import starwars from './starwars.json';
import tube from './tube.json';
import * as d3 from "d3";

let people = [];
let mostRecentlyAssignedID = 0;
let currentFocalPerson = null;
let spiderDiagramAvoidPeople = [];
let spiderDiagramAvoidRelationText = [];
let roles = [];

let colouredConnectionTexts = {};
let USE_COLOURED_CONNECTION_TEXTS = false;
let ALWAYS_SETTLE_FOR_VACANT = false;
let DRAW_ANGLED_NAME_TEXT = false;
let INCLUDE_RELATION_TYPE_IN_VERBOSE_OUTPUT = true;

let dataInD3Format = null;

const FAMILY_RELATIONSHIPS_RELATIVE_LEVELS = {"PARENT":-1,
                                              "GRANDPARENT":-2,
                                              "SIBLING":0,
                                              "SPOUSE":0,
                                              "CHILD":1,
                                              "GRANDCHILD":2
                                              }

const FAMILY_RELATIONSHIPS_KEYS = Object.keys(FAMILY_RELATIONSHIPS_RELATIVE_LEVELS)

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

let oldMousePos = null;

function mousedownFunction (e){
  oldMousePos = [e.screenX, e.screenY];  
}

function mouseMoveFunction (e){
  if (oldMousePos != null){

  }
}

function mouseUpFunction(e){
  oldMousePos = null;
}


window.addEventListener("mousemove", (e) => {
  mouseMoveFunction(e);
});

window.addEventListener("mouseup", (e) => {
  mouseUpFunction(e);
});

shortestPathAnswerText.addEventListener("mousedown", (e) => {
  mousedownFunction(e);
});

function reset(){
  mostRecentlyAssignedID = 0;
  people = [];
  roles = [];
  colouredConnectionTexts = {};
  spiderDiagramAvoidPeople = [];
  ALWAYS_SETTLE_FOR_VACANT = false;
  USE_COLOURED_CONNECTION_TEXTS = true;
  INCLUDE_RELATION_TYPE_IN_VERBOSE_OUTPUT = true;
}

function setCurrentFocalPerson(p){
  currentFocalPerson = p;
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
  INCLUDE_RELATION_TYPE_IN_VERBOSE_OUTPUT = true;

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
        case "INCLUDE_RELATION_TYPE_IN_VERBOSE_OUTPUT":
          INCLUDE_RELATION_TYPE_IN_VERBOSE_OUTPUT = jsonSettings.INCLUDE_RELATION_TYPE_IN_VERBOSE_OUTPUT;
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
                            DRAW_ANGLED_NAME_TEXT:DRAW_ANGLED_NAME_TEXT,
                            INCLUDE_RELATION_TYPE_IN_VERBOSE_OUTPUT:INCLUDE_RELATION_TYPE_IN_VERBOSE_OUTPUT
                          };

  return JSON.stringify(output);
}

function updateHTML(){
    let app = document.getElementById("app");
    app.innerHTML = "";
    app.appendChild(currentFocalPerson.getAnchorTag());
    app.appendChild(currentFocalPerson.getRelationsDiv());
    personConnectionDropdownChanged(false);
    document.getElementById("svg-holder").innerHTML = "";
    let svg = makeSVG(dataInD3Format);
    console.log(svg);
    document.getElementById("svg-holder").appendChild(svg);
}

function makePlainD3Node(degreesFromFocalPerson, prevPersonInWeb){
  return ({
    "p":null,
    "level": degreesFromFocalPerson,
    "children":[],
    "prevPersonInWeb": prevPersonInWeb,
    "isAccountedForInChildrenSomewhere": false
  })
}

function recalculateSpiderDiagram(){

  dataInD3Format = makePlainD3Node(0, null);

  let maxLevel = -1;

  let MONITOR_NODES_THAT_COULD_NOT_BE_REACHED = false;

  people.forEach((otherPerson) => {
    otherPerson.unhighlightRelations();

    let level = currentFocalPerson.getDegreesOfSeparationFrom(otherPerson, spiderDiagramAvoidPeople, false, true).degrees;

	  if (level == undefined){ 
      if (MONITOR_NODES_THAT_COULD_NOT_BE_REACHED){
        couldNotBeReached.push(otherPerson);
      }
      otherPerson.d3Node = makePlainD3Node(-1, null)
      return;
	  }

    if (level == 0){ //root person
      otherPerson.d3Node = dataInD3Format;
      otherPerson.d3Node.p = otherPerson;
    } else {
      otherPerson.d3Node = makePlainD3Node(level, null);
      otherPerson.d3Node.p = otherPerson;
    }
    
    otherPerson.isAddedToWeb = false;

    if (spiderDiagramAvoidPeople.includes(otherPerson)){
      return;
    }
		
    if (level > maxLevel){
      maxLevel = level;
    }
  });    

  if (MONITOR_NODES_THAT_COULD_NOT_BE_REACHED){
    let couldNotBeReachedString = "The following nodes could not be reached from the chosen centrepoint: ";

    couldNotBeReached.forEach((item) => {
      couldNotBeReachedString += item.name + ", ";
    })
    console.log(couldNotBeReachedString)
  }

  for (let L = 0; L <= maxLevel; L++){

    people.forEach((person) => {      

      if (person.d3Node.level == L){
        person.relations.forEach((relation) => {
          if (spiderDiagramAvoidRelationText.includes(relation.description)){
            return;
          }
          for (let i = 0; i < people.length; i++){
            let otherPerson = people[i];
            if (otherPerson == person){ //can't link to yourself! IT would create a cyclical reference
              continue;
            }
            if (otherPerson == relation.getOtherPerson()){ //if the other person in this relationship is already added to the web, don't add them again. The return returns the forEach iteration in the relations array, not the wider function.
              if (otherPerson.isAddedToWeb){
                return;
              } else {
                if (!otherPerson.d3Node.isAccountedForInChildrenSomewhere){
                  otherPerson.d3Node.isAccountedForInChildrenSomewhere = true;
                  person.d3Node.children.push(otherPerson.d3Node) //but this doesn't count as adding them to the web; they'll be processed when their turn comes
                }
                otherPerson.d3Node.prevPersonInWeb = person.d3Node;
              }
            }
          }
          person.isAddedToWeb = true;
        });
      }        
    });
  }

  people.forEach(person => { //sanitise the json format to avoid circular references (reduce everything to standard data rather than objects)
    person.d3Node.prevPersonInWeb = "";
    person.d3Node.p = person.d3Node.p == null ? null : person.d3Node.p.name
  });

  console.log(dataInD3Format)
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
        return {degrees:0,report:null,relativeFamilyLevel:0};
      } else {
        return {degrees:0,report: targetPerson.name+" and "+targetPerson.name+" are the same person, so the degrees of separation are 0.",relativeFamilyLevel:0};
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
    let relativeFamilyLevel = 0;

    if (targetFound){
      if (numberOnly){
        return {degrees: peopleAndCounts[targetPerson.id], report:null}
      }

      let curPerson = targetPerson;
      let prev = peopleAndPrevPeople[targetPerson.id];
      
      let firstLoop = true;

      console.log("Let's find out how "+targetPerson.name+" is related to "+this.name)

        while (prev != null) {
          reportString += curPerson.name;

          let relationshipToPrev = curPerson.getImmediateRelationshipTextTo(prev);

          if (INCLUDE_RELATION_TYPE_IN_VERBOSE_OUTPUT){
            reportString += ((firstLoop) ? " " : ", who ") + relationshipToPrev;
          } else {
            reportString += " -> ";
          }
          
          console.log(relationshipToPrev)
          if (FAMILY_RELATIONSHIPS_KEYS.includes(relationshipToPrev)){
            relativeFamilyLevel += FAMILY_RELATIONSHIPS_RELATIVE_LEVELS[relationshipToPrev];
            console.log(relativeFamilyLevel)
          }
          
          curPerson.getImmediateRelationshipTo(prev).highlighted = true;
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

    return {degrees: peopleAndCounts[targetPerson.id], report:reportString, relativeFamilyLevel:relativeFamilyLevel};
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

function drag(simulation) {
  
  function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }
  
  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }
  
  function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }
  
  return d3.drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended);
}
function makeSVG(data) {

  // Specify the chart’s dimensions.
  const width = window.innerWidth;
  const height = window.innerHeight;

  // Compute the graph and start the force simulation.
  const root = d3.hierarchy(data);
  const links = root.links();
  const nodes = root.descendants();

  const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id(d => d.id).distance(10).strength(1))
      .force("charge", d3.forceManyBody().strength(-1900))
      .force("x", d3.forceX())
      .force("y", d3.forceY());

  // Create the container SVG.
  const svg = d3.create("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [-width / 2, -height / 2, width, height])
      .attr("style", "max-width: 100%; height: auto;");

  // Append links.
  const link = svg.append("g")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6)
    .selectAll("line")
    .data(links)
    .join("line");

  // Append nodes.
  const node = svg.append("g")
      .attr("fill", "#000")
      .attr("stroke", "#000")
      .attr("stroke-width", 1.5)
    .selectAll("g")
    .data(nodes)
    .join("g")
    .call(drag(simulation));

  node.append("title")
      .text(d => d.data.p);

  node.append("circle")
    .attr("fill", d => d.children ? null : "#000")
    .attr("stroke", d => d.children ? null : "#000")
    .attr("r", 7)

  node.append("text")
      .attr("font-size",16)
      .attr("fill", "white")
      .attr("stroke","none")
      .attr("text-anchor","middle")
      .text(d => d.data.p);

  simulation.on("tick", () => {
    link
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

    node
        .attr("transform", function(d){return "translate("+d.x+" "+d.y+")"})
  });

  return svg.node();
}


function addTempMapViaCode(){
  reset();

  // * START OF MODIFIABLE SECTION *
  
  //put addPerson() statements here

  //put getPerson().addRelation() statements here:

  // * END OF MODIFIABLE SECTION *

  setupAfterLoad();
  console.log(getAllAsJSON());
}

dropdown.appendChild(makeOptionFor(majora, "Majora's Mask"));
dropdown.appendChild(makeOptionFor(hamlet, "Hamlet"));
dropdown.appendChild(makeOptionFor(starwars, "Star Wars"));
dropdown.appendChild(makeOptionFor(vampire, "Vampire"));
//dropdown.appendChild(makeOptionFor(tube, "Tube"));


reset();
dropdown.children[0].click();

//addTempMapViaCode();
