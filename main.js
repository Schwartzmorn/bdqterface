"use strict";

/*
 * Template: clone dom elements from #templates and customize them
 * according to the object given in input of getNode(): a string 
 * to modify the content of the DOM element matching the key, an
 * object to modify its properties.
 */
function Template(iTemplateName) {
    this.templateName = iTemplateName;
}

Template.prototype = {
getTemplates : function () {
    var theTemplatesNodes = document.getElementById("templates").children;
    for (var i = 0; i < theTemplatesNodes.length; ++i) {
        var theChild = theTemplatesNodes[i];
        if (theChild.getAttribute("data-template") != null) {
            Template.prototype.templates[theChild.getAttribute("data-template")] = theChild;
        }
    }
},
getTemplate : function () {
    if (!(this.templates)) {
        Template.prototype.templates = {};
        this.getTemplates();
    }
    return this.templates[this.templateName];
},
setValue : function(iNode, iKey, iValue) {
    var targetNode;
    if (iNode && iKey && iValue) {
        if (iNode.getAttribute('name') == iKey) {
            targetNode = iNode;
        } else {
            targetNode = iNode.querySelector('[name="' + iKey + '"]');
        }
    }
    if (targetNode) {
        if (typeof(iValue) == "string") {
            var aTextNode = document.createTextNode(iValue);
            targetNode.insertBefore(aTextNode, targetNode.firstChild);
        } else {
            for (var property in iValue) {
                if (iValue.hasOwnProperty(property)) {
                    targetNode.setAttribute(property, iValue[property]);
                }
            }
        }
    }
},
getNode : function(iValues) {
    var theTemplate = this.getTemplate();
    if (theTemplate) {
        var theNode = theTemplate.cloneNode(true);
        if (theNode) {
            for (var property in iValues) {
                if (iValues.hasOwnProperty(property)) {
                    this.setValue(theNode, property, iValues[property]);
                }
            }
        }
    }
    return theNode;
},
}

/*
 * Command Handler: parse and dispatch commands from the main input
 * Also keeps an history of the commands given
 */
function CommandHandler(iInput, iLogger) {
    this.logger = iLogger;
    if (localStorage) {
        var a = localStorage.getItem("history");
        try {
            if (a) {
                this.history = JSON.parse(a);
            }
        } catch (e) {}
    }
    if (!this.history) {
        this.history = [];
    }
    this.curComHis = -1;
    this.curCommand = "";
    this.actors = {};
    this.input = iInput;
    iInput.addEventListener("keyup", this.act.bind(this));
}

CommandHandler.prototype = {
help : function (iArgs) {
    if (iArgs && iArgs.length > 0) {
        if (this.actors[iArgs[0]]) {
            if (iArgs[0] == "help") {
                this.logger.pushResponse("This is the help. Duh.")
            } else {
                this.logger.pushResponse ("***** " + iArgs[0] + " *****");
                if (this.actors[iArgs[0]].help) {
                    this.logger.pushResponse(this.actors[iArgs[0]].help());
                } else {
                    this.logger.pushResponse("No help available for command " + iArgs[0] + ".")
                }
            }
        } else {
            this.logger.pushResponse("Unknown command " + iArgs[0] + ".");
        }
    } else {
        this.logger.pushResponse("Available commands:");
        for (var key in this.actors) {
            if (this.actors.hasOwnProperty(key)) {
                this.logger.pushResponse ("***** " + key + " *****")
            }
        }
        this.logger.pushResponse("Type help [command] for more information.");
    }
},
store : function () {
    if (localStorage) {
        var thePrunedHis = this.history.slice(this.history.length - 50, this.history.length);
        localStorage.setItem("history", JSON.stringify(thePrunedHis));
    }
},
act : function (iArgs) {
    var theKey = iArgs.key || iArgs.keyIdentifier;
    switch(theKey) {
    case 'Enter':
        this.fireCommand();
        break;
    case 'Up':
        this.setPreviousCommand();
        break;
    case 'Down':
        this.setNextCommand();
        break;
    default:
    }
},
fireCommand : function () {
    if (!/^\s*$/.test(this.input.value)) {
        this.curComHis = -1;
        if (this.input.value != this.history[this.history.length - 1]) {
            this.history.push(this.input.value);
        }
        this.dispatchCommand(this.input.value);
        this.input.value = "";
        this.store();
    }
},
setPreviousCommand : function () {
    if (this.history.length > 0) {
        if (this.curComHis == -1) {
            this.curCommand = this.input.value;
            this.curComHis = this.history.length - 1;
        } else if (this.curComHis > 0) {
            this.curComHis = this.curComHis - 1;
        }
        this.input.value = this.history[this.curComHis];
    }
},
setNextCommand : function () {
    if (this.history.length > 0) {
        if (this.curComHis == this.history.length - 1) {
            this.input.value = this.curCommand;
            this.curComHis = -1;
        } else if (this.curComHis < this.history.length - 1 &&
                    this.curComHis != -1) {
            this.curComHis += 1;
            this.input.value = this.history[this.curComHis];
        }
    }
},
dispatchCommand : function(iCommand) {
    this.logger.pushCommand(iCommand);
    var theArgs = iCommand.split(/\s+/);
    if (theArgs[0] == "") {
        theArgs.splice(0, 1);
    }
    if (theArgs[theArgs.length - 1] == "") {
        theArgs.pop();
    }
    var command = theArgs.splice(0, 1);
    if (command == "help") {
        this.help(theArgs);
    } else if (this.actors[command]) {
        try {
            this.actors[command].act(theArgs);
        } catch(e) {
            this.logger.pushResponse("Error while executing command " + command + ".");
            console.log(e);
        }
    } else {
        this.logger.pushResponse("Error: unknown command " + command + ".");
    }
},
addActor : function (iActor) {
    this.actors[iActor.actionName] = iActor;
    return iActor;
},
getActor : function (iActorClass) {
    if (typeof(iActorClass) == "string") {
        return this.actors[iActorClass];
    } else {
        if (iActorClass.prototype.actionName) {
            return this.actors[iActorClass.prototype.actionName];
        }
    }
}
}

/*
 * Logger: used to log actions and their result
 */
function Logger(iLogElement, iCommandTemplate, iResponseTemplate) {
    this.log = iLogElement;
    this.commandTemplate = iCommandTemplate;
    this.responseTemplate = iResponseTemplate;
}

Logger.prototype = {
goToBottom : function () {
    this.log.scrollTop = this.log.scrollHeight;
},
pushCommand : function (iCommand) {
    this.log.appendChild(this.commandTemplate.getNode({content : '>' + iCommand,}));
    this.goToBottom();
},
pushResponse : function (iResponse) {
    this.log.appendChild(this.responseTemplate.getNode({content : iResponse}));
    this.goToBottom();
},
}

/*
 * Interactive result display olol
 */
function ResultDisplay (iResult) {
    this.resultDisplay = iResult;
    this.templates = {};
}

ResultDisplay.prototype = {
addTemplate : function (iTemplate) {
    this.templates[iTemplate.templateName] = iTemplate;
},
display : function (iTemplateName, iValues) {
    if (this.templates[iTemplateName]) {
        var aNode = this.templates[iTemplateName].getNode(iValues);
        this.resultDisplay.appendChild(aNode);
        return aNode;
    }
},
clearDisplay : function() {
    while (this.resultDisplay.firstChild) {
        this.resultDisplay.removeChild(this.resultDisplay.firstChild);
    }
},
}

function MenuHandler () {
    this.displayed = false;
    window.addEventListener("resize", this.hide.bind(this));
    document.body.addEventListener("click", this.hide.bind(this));
}

MenuHandler.prototype = {
clickator : function () {
    console.log("test");
},
hide : function () {
    if (this.currentMenu) {
        document.body.removeChild(this.currentMenu);
        this.currentMenu = null;
    }
},
getInstance : function () {
    if (!MenuHandler.prototype.instance) {
        MenuHandler.prototype.instance = new MenuHandler ();
    }
    return MenuHandler.prototype.instance;
},
display : function (iMenu, iEvt) {
    this.hide();
    iEvt.stopPropagation();
    this.currentMenu = iMenu.node;
    var theX = iEvt.x || iEvt.clientX;
    var theY = iEvt.y || iEvt.clientY;
    document.body.appendChild(iMenu.node);
    var theMaxX = window.innerWidth - iMenu.node.offsetWidth - 1;
    var theMaxY = window.innerHeight - iMenu.node.offsetHeight - 1;
    iMenu.node.style.left = Math.min(theX, theMaxX) + 'px';
    iMenu.node.style.top = Math.min(theY, theMaxY) + 'px';
},
}

function Menu () {
    this.node = this.menuTemplate.getNode();
}

Menu.prototype = {
menuTemplate : new Template("menu"),
itemTemplate : new Template("menuItem"),
addItem : function (iName, iOnclick) {
    var theItem = this.node.appendChild(this.itemTemplate.getNode({item : iName}));
    theItem.addEventListener("click", iOnclick);
    theItem.addEventListener("click", MenuHandler.prototype.getInstance().hide.bind(MenuHandler.prototype.getInstance()));
},
}

window.onload = function() {
    var aLogComTmpl = new Template("logCommand");
    var aLogResTmpl = new Template("logResponse");
    var aDisplay = new ResultDisplay(document.getElementById("resultContainer"));
    aDisplay.addTemplate(new Template("result"));
    aDisplay.addTemplate(new Template("torrent"));
    var aLogger = new Logger(document.getElementById("historyCont"), aLogComTmpl, aLogResTmpl);
    var aHandler = new CommandHandler(document.getElementById("mainInput"), aLogger);
    aHandler.addActor(new Searcher(aLogger, aDisplay));
    var aReporter = aHandler.addActor(new StatusReporter(aLogger, aDisplay));
    aHandler.addActor(new Downloader(aLogger, aHandler.getActor(Searcher)));
    aHandler.getActor(Searcher).downloader = aHandler.getActor(Downloader);
    aHandler.addActor(new TorrentActor(aLogger, aHandler.getActor(StatusReporter), "start"));
    aHandler.addActor(new TorrentActor(aLogger, aHandler.getActor(StatusReporter), "stop"));
    aHandler.addActor(new TorrentRemover(aLogger, aHandler.getActor(StatusReporter)));
}