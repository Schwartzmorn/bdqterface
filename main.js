"use strict";

var parserUrl="http://pbparser.appspot.com/search/main/"
function httpGet(iUrl) {
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.open( "GET", iUrl, false );
    xmlHttp.send( null );
    return xmlHttp.responseText;
}

var templates = {};

function getTemplates() {
    var theTemplatesNodes = document.getElementById("templates").children;
    for (var i = 0; i < theTemplatesNodes.length; ++i) {
        var theChild = theTemplatesNodes[i];
        if (theChild.getAttribute("data-template") != null) {
            templates[theChild.getAttribute("data-template")] = theChild;
        }
    }
}

function Template(iTemplateName) {
    this.templateName = iTemplateName;
}

Template.prototype.setValue = function(iNode, iKey, iValue) {
    if (iNode && iKey && iValue) {
        var theEl = iNode.querySelector('[name="' + iKey + '"');
        if (theEl) {
            theEl.innerHTML = iValue;
        }
    }
}

Template.prototype.getNode = function(iValues) {
    var theTemplate = templates[this.templateName]
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
}

window.onload = function() {
    getTemplates();
    var aResult = new Template("result");
    document.getElementById("resultContainer").appendChild(aResult.getNode());
    document.getElementById("resultContainer").appendChild(aResult.getNode({title: "THIS IS THE BEST TORRENT EVER", id: "[2]", seeds: "1231", }));
}