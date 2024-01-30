import './style.css'
import javascriptLogo from './javascript.svg'
import viteLogo from '/vite.svg'

let people = [];
let mostRecentlyAssignedID = 0;

let currentFocalPerson = null;

function setCurrentFocalPerson(p){
  currentFocalPerson = p;
  updateHTML();
}

function updateHTML(){
    let app = document.getElementById("app");
    app.innerHTML = "";
    app.appendChild(currentFocalPerson.getAnchorTag());
    app.appendChild(currentFocalPerson.getRelationsDiv());
}

function getPerson(name){
  name = name.toLowerCase();
  for (let i = 0; i < people.length; i++){
    let p = people[i];
    if (p.name.toLowerCase() == name){
      return p;
    }
  }
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

function getNextID(){
  return mostRecentlyAssignedID++;
}

class Person {
  constructor (name) {
      this.id = getNextID();
      this.name = name;
      this.relations = [];
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
}

function addPerson(name){
  people.push(new Person(name));
}

addPerson("Happy Mask Salesman")
addPerson("Link")
addPerson("Skull Kid")
addPerson("Tatl")
addPerson("Tael")
addPerson("Anju")
addPerson("Kafei")
addPerson("Anju's mother")
addPerson("Anju's grandmother")
addPerson("Tortus")
addPerson("Cremia")
addPerson("Curiosity Shop Owner")
addPerson("Sakon")
addPerson("Gorman")
addPerson("Guru-Guru")
addPerson("Judo Rosa")
addPerson("Marilla Rosa")
addPerson("Twin Jugglers")
addPerson("Kamaro")
addPerson("Gorman Bros.")
addPerson("Romani")
addPerson("the Aliens")
addPerson("Mayor Dotour")
addPerson("Madame Aroma")
addPerson("Viscen")
addPerson("Mutoh")
addPerson("the Milk Bar Owner")
addPerson("Postman")
addPerson("Majora")
addPerson("the Four Giants")
addPerson("Jim")
addPerson("the Bombers")
addPerson("Professor Shikashi")
addPerson("Deku King")
addPerson("Deku Butler")
addPerson("Deku Princess")
addPerson("Monkey")
addPerson("Monkeys")
addPerson("Koume")
addPerson("Kotake")
addPerson("Kaepora Gaebora")
addPerson("Tingle")
addPerson("Tingle's father")
addPerson("Part-time worker")
addPerson("Bomb shop owner")
addPerson("Old lady from the bomb shop")
addPerson("Bean seller")
addPerson("Banker")
addPerson("Mikau")
addPerson("Darmani")
addPerson("the Deku Butler's son")
addPerson("Pamela's father")
addPerson("Pamela")
addPerson("Honey")
addPerson("Darling")
addPerson("Lulu")
addPerson("Evan")
addPerson("Japas")
addPerson("Tijo")
addPerson("Toto")
addPerson("Aveil")

getPerson("Happy Mask Salesman").addRelation(getPerson("Link"), "assigns a mask retrieval mission to", "receives a mask retrieval mission from the", true)
getPerson("Happy Mask Salesman").addRelation(getPerson("Skull Kid"), "was mugged by", "stole an ancient cursed mask from the", true)
getPerson("Happy Mask Salesman").addRelation(getPerson("the Bombers"), "has a notebook belonging to", "created a notebook currently in the possession of the", true)
getPerson("Tatl").addRelation(getPerson("Skull Kid"), "used to be friends with", "used to be friends with", true)
getPerson("Tatl").addRelation(getPerson("Link"), "begrudgingly accompanies", "is begrudgingly accompanied by", true)
getPerson("Tatl").addRelation(getPerson("Tael"), "is sister to", "is the brother of", true)
getPerson("Tael").addRelation(getPerson("Skull Kid"), "used to be friends with", "used to be friends with", true)
getPerson("Anju").addRelation(getPerson("Kafei"), "is engaged to", "is engaged to", true)
getPerson("Anju").addRelation(getPerson("Cremia"), "is friends with", "is friends with", true)
getPerson("Anju").addRelation(getPerson("Tortus"), "is the daughter of", "was the father of", true)
getPerson("Kafei").addRelation(getPerson("Skull Kid"), "was transformed into a child by", "has set a curse on", true)
getPerson("Anju's grandmother").addRelation(getPerson("Anju"), "is grandmother to", "is the granddaughter of", true)
getPerson("Anju's grandmother").addRelation(getPerson("Tortus"), "was mother to", "was the son of", true)
getPerson("Anju's grandmother").addRelation(getPerson("Anju's mother"), "is the mother-in-law of", "is the daughter-in-law of", true)
getPerson("Anju's grandmother").addRelation(getPerson("Mayor Dotour"), "was a teacher of", "was taught by", true)
getPerson("Anju's mother").addRelation(getPerson("Anju"), "is mother to", "is the daughter of", true)
getPerson("Anju's mother").addRelation(getPerson("Tortus"), "was wife to", "was the husband of", true)
getPerson("Anju's mother").addRelation(getPerson("Cremia"), "believes Kafei ran off with", "is believed to have run off with Kafei by", true)
getPerson("Anju's mother").addRelation(getPerson("Kafei"), "believes Cremia ran off with", "is believed to have run off with Cremia by", true)
getPerson("Curiosity Shop Owner").addRelation(getPerson("Kafei"), "offers protection to", "is being sheltered by", true)
getPerson("Curiosity Shop Owner").addRelation(getPerson("Sakon"), "is reluctant to purchase goods from", "feels he is being ripped off by", true)
getPerson("Sakon").addRelation(getPerson("Kafei"), "has stolen a wedding mask from", "had his wedding mask stolen by", true)
getPerson("Link").addRelation(getPerson("Sakon"), "infiltrates the hideout of", "has his hideout infiltrated by", true)
getPerson("Gorman").addRelation(getPerson("Guru-Guru"), "leads a circus troupe employing", "is in a circus troupe led by", true)
getPerson("Gorman").addRelation(getPerson("Judo Rosa"), "leads a circus troupe employing", "is a dancer in a circus troupe led by", true)
getPerson("Gorman").addRelation(getPerson("Marilla Rosa"), "leads a circus troupe employing", "is a dancer in a circus troupe led by", true)
getPerson("Judo Rosa").addRelation(getPerson("Marilla Rosa"), "is the twin sister of", "is the twin sister of", true)
getPerson("Gorman").addRelation(getPerson("Twin Jugglers"), "leads a circus troupe employing", "juggle for a circus troupe led by", true)
getPerson("Link").addRelation(getPerson("Judo Rosa"), "brings inspiration to", "is inspired by a dance performance from", true)
getPerson("Link").addRelation(getPerson("Marilla Rosa"), "brings inspiration to", "is inspired by a dance performance from", true)
getPerson("Link").addRelation(getPerson("Kamaro"), "heals the soul of", "is healed by", true)
getPerson("Link").addRelation(getPerson("Mikau"), "heals the soul of", "is healed by", true)
getPerson("Link").addRelation(getPerson("Darmani"), "heals the soul of", "is healed by", true)
getPerson("Link").addRelation(getPerson("the Deku Butler's son"), "takes the form of", "is healed by", true)
getPerson("Link").addRelation(getPerson("Pamela's father"), "heals the soul of", "is healed by", true)
getPerson("Link").addRelation(getPerson("Kafei"), "infiltrates Sakon's hideout with", "infiltrates Sakon's hideout with", true)
getPerson("Pamela's father").addRelation(getPerson("Pamela"), "is the father of", "is the daughter of", true)
getPerson("Gorman Bros.").addRelation(getPerson("Gorman"), "are the other two brothers of", "is the third brother to the two", true)
getPerson("Gorman Bros.").addRelation(getPerson("Cremia"), "are terrorising", "is terrorised by the", true)
getPerson("the Aliens").addRelation(getPerson("Romani"), "temporarily abduct", "is temporarily abducted by", true)
getPerson("the Aliens").addRelation(getPerson("Cremia"), "are stealing cows from", "had her cows stolen by", true)
getPerson("the Aliens").addRelation(getPerson("Link"), "are defeated by", "defeats", true)
getPerson("Cremia").addRelation(getPerson("Romani"), "is the older sister of", "is the younger sister of", true)
getPerson("Mayor Dotour").addRelation(getPerson("Kafei"), "is father to", "is the son of", true)
getPerson("Madame Aroma").addRelation(getPerson("Kafei"), "is mother to", "is the son of", true)
getPerson("Madame Aroma").addRelation(getPerson("Mayor Dotour"), "is wife to", "is husband to", true)
getPerson("Viscen").addRelation(getPerson("Mayor Dotour"), "is advisor to", "is advised by", true)
getPerson("Mutoh").addRelation(getPerson("Mayor Dotour"), "continually berates", "is continually berated by", true)
getPerson("Madame Aroma").addRelation(getPerson("Gorman"), "regretfully cancels the act of", "has his act cancelled by", true)
getPerson("Gorman").addRelation(getPerson("the Milk Bar Owner"), "drinks at the establishment of", "serves", true)
getPerson("Madame Aroma").addRelation(getPerson("the Milk Bar Owner"), "drinks at the establishment of", "serves", true)
getPerson("Madame Aroma").addRelation(getPerson("Link"), "requests help from", "serves as a detective for", true)
getPerson("Postman").addRelation(getPerson("Anju"), "delivers a letter to", "receives a letter from the", true)
getPerson("Postman").addRelation(getPerson("Kafei"), "delivers a letter to", "receives a letter from the", true)
getPerson("Postman").addRelation(getPerson("Madame Aroma"), "is employed by", "employs the", true)
getPerson("Postman").addRelation(getPerson("Postman"), "delivers a letter to", "receives a letter from the", false)
getPerson("Postman").addRelation(getPerson("Link"), "gives the bunny hood to", "is given the bunny hood by the", true)
getPerson("Majora").addRelation(getPerson("Skull Kid"), "possesses", "is possessed by", true)
getPerson("the Four Giants").addRelation(getPerson("Skull Kid"), "still consider themselves friends to", "believes he was betrayed by", true)
getPerson("the Four Giants").addRelation(getPerson("Link"), "are freed by", "frees", true)
getPerson("Jim").addRelation(getPerson("Link"), "recruits", "is recruited by", true)
getPerson("Jim").addRelation(getPerson("the Bombers"), "is the leader of the", "are led by", true)
getPerson("Deku Butler").addRelation(getPerson("Link"), "is reminded of his son by", "is challenged to a race by the", true)
getPerson("Deku Butler").addRelation(getPerson("the Deku Butler's son"), "is the father of", "is the son of the", true)
getPerson("Professor Shikashi").addRelation(getPerson("the Bombers"), "is familiar with", "know", true)
getPerson("Deku King").addRelation(getPerson("Deku Princess"), "is the father of", "is the daughter of", true)
getPerson("Deku King").addRelation(getPerson("Deku Butler"), "employs the", "works for the", true)
getPerson("Deku King").addRelation(getPerson("Monkey"), "imprisons the", "is currently imprisoned by", true)
getPerson("Monkey").addRelation(getPerson("Deku Princess"), "is accused of kidnapping the", "is falsely assumed to have been kidnapped by", true)
getPerson("Tingle").addRelation(getPerson("Link"), "sells maps to", "buys maps from", true)
getPerson("Tingle's father").addRelation(getPerson("Tingle"), "is the father of", "is the son of", true)
getPerson("Tingle's father").addRelation(getPerson("Koume"), "works in the Swamp Tourist Center with", "works in the Swamp Tourist Center with", true)
getPerson("Koume").addRelation(getPerson("Kotake"), "is the sister of", "is the sister of", true)
getPerson("Monkeys").addRelation(getPerson("Monkey"), "want to rescue their friend,", "is friends with his fellow", true)
getPerson("Monkeys").addRelation(getPerson("Koume"), "know the route through the woods to", "is stranded at a location known only by the", true)
getPerson("Kaepora Gaebora").addRelation(getPerson("Link"), "teaches the Song of Soaring to", "is taught the Song of Soaring by", true)
getPerson("Part-time worker").addRelation(getPerson("Curiosity Shop Owner"), "works for", "employs the", true)
getPerson("Bomb shop owner").addRelation(getPerson("Old lady from the bomb shop"), "is the son of", "is the mother of", true)
getPerson("Sakon").addRelation(getPerson("Old lady from the bomb shop"), "steals the bomb bag from the", "is mugged by", true)
getPerson("Bean seller").addRelation(getPerson("Link"), "sells magic beans to", "is sold magic beans by the", true)
getPerson("Banker").addRelation(getPerson("Link"), "accepts custom from", "banks with the", true)
getPerson("Honey").addRelation(getPerson("Darling"), "loves", "loves", true)
getPerson("Mikau").addRelation(getPerson("Lulu"), "is the partner of", "is the partner of", true)
getPerson("Lulu").addRelation(getPerson("Evan"), "is the bandmate of", "is the bandmate of", true)
getPerson("Lulu").addRelation(getPerson("Japas"), "is the bandmate of", "is the bandmate of", true)
getPerson("Lulu").addRelation(getPerson("Tijo"), "is the bandmate of", "is the bandmate of", true)
getPerson("Lulu").addRelation(getPerson("Toto"), "is in a band managed by", "manages a band that includes", true)
getPerson("Evan").addRelation(getPerson("Mikau"), "is the bandmate of", "is the bandmate of", true)
getPerson("Evan").addRelation(getPerson("Japas"), "is the bandmate of", "is the bandmate of", true)
getPerson("Evan").addRelation(getPerson("Tijo"), "is the bandmate of", "is the bandmate of", true)
getPerson("Evan").addRelation(getPerson("Toto"), "is in a band managed by", "manages a band that includes", true)
getPerson("Japas").addRelation(getPerson("Mikau"), "is the bandmate of", "is the bandmate of", true)
getPerson("Japas").addRelation(getPerson("Tijo"), "is the bandmate of", "is the bandmate of", true)
getPerson("Japas").addRelation(getPerson("Toto"), "is in a band managed by", "manages a band that includes", true)
getPerson("Tijo").addRelation(getPerson("Mikau"), "is the bandmate of", "is the bandmate of", true)
getPerson("Tijo").addRelation(getPerson("Toto"), "is in a band managed by", "manages a band that includes", true)
getPerson("Mikau").addRelation(getPerson("Toto"), "is in a band managed by", "manages a band that includes", true)
getPerson("Toto").addRelation(getPerson("Madame Aroma"), "is in carnival-related talks with", "is in carnival-related talks with", true)
getPerson("Aveil").addRelation(getPerson("Lulu"), "leads a group of pirates who stole eggs from", "had her eggs stolen by a group of pirates led by", true)
getPerson("Aveil").addRelation(getPerson("Mikau"), "leads a group of pirates who have mortally wounded", "was mortally wounded by a group of pirates led by", true)

setCurrentFocalPerson(getPerson("Happy Mask Salesman"))

people.forEach((person) => {
  people.forEach((otherPerson) => {
    console.log(person.getDegreesOfSeparationFrom(otherPerson, [getPerson("Link")]));
  })
})

console.log(getPerson("Happy Mask Salesman").getDegreesOfSeparationFrom(getPerson("Anju"),[getPerson("Link")]));