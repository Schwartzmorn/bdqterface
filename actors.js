"use strict";

/*
 * Searcher: responsible for getting and displaying torrent searches
 */
function Searcher(iLogger, iDisplayResult) {
    this.url = "https://pbparser.appspot.com/search/main/";
    this.logger = iLogger;
    this.result = iDisplayResult;
}

Searcher.prototype = {
actionName : "search",
help : function () {
    return "Usage: space separated keywords";
},
displayResults : function (iResults) {
    this.logger.pushResponse(iResults.length + " results found");
    this.result.clearDisplay();
    for (var i = 0; i < iResults.length; ++i) {
        iResults[i]["id"] = "" + (i + 1);
        var theNode = this.result.display("result", iResults[i]);
        if (this.downloader) {
            theNode.addEventListener("click", this.downloader.act.bind(this.downloader, i + 1));
        }
    }
},
searchCallback : function (iReq, iEvt) {
    if (iReq.readyState == 4) {
        if (iReq.status == 200) {
            try {
                this.lastResult = JSON.parse(iReq.responseText);
                this.displayResults(this.lastResult);
            } catch(e) {
                console.log(e);
                this.logger.pushResponse("Error while doing search.");
            }
        } else {
            this.logger.pushResponse("Error " + iReq.status + " encountered while doing search.");
        }
    }
},
act : function (iQuery) {
    if (iQuery.length == 0) {
        this.logger.pushResponse("Error: no search given");
    }
    var theUrl = this.url;
    for (var i = 0; i < iQuery.length; ++i) {
        theUrl += iQuery[i];
        theUrl += '%20';
    }
    theUrl = theUrl.substring(0, theUrl.length - 3);
    var aReq = new XMLHttpRequest();
    aReq.open('GET', theUrl, true);
    aReq.onreadystatechange = this.searchCallback.bind(this, aReq);
    aReq.send();
},
}

/*
 * Helper function to deal with the transmission proxy
 */
function transmission(iCaller, iMethod, iArguments, iCallback) {
    var aReq = new XMLHttpRequest();
    aReq.open('POST', "https://pbparser.appspot.com/proxy", true);
    aReq.onreadystatechange = iCallback.bind(iCaller, aReq);
    var aFormData = new FormData();
    aFormData.append("method", iMethod);
    aFormData.append("args", JSON.stringify(iArguments));
    aReq.send(aFormData);
}

/*
 * Status Reporter: responsible for getting and displaying torrent status
 */
function StatusReporter(iLogger, iResults) {
    this.logger = iLogger;
    this.results = iResults;
}

StatusReporter.prototype = {
actionName : "status",
transmissionStatuses : {
    "-1": "All",
    0: "Stopped",
    1: "Check waiting",
    2: "Checking",
    3: "Download waiting",
    4: "Downloading",
    5: "Seed waiting",
    6: "Seeding"
},
pushTorrent : function (iFields) {
    var theNode = this.results.display("torrent" , iFields);
    var comp = iFields.percentDone * 100;
    var theBar = theNode.querySelector("[name='progressBar']");
    theBar.setAttribute("style", "width: " + comp + "%");
},
getAttributes : function (iTorrent) {
    var theAttributes = {};
    if (iTorrent.error != 0) {
        if (iTorrent.percentDone != 1) {
            theAttributes["data-status"] = "inError";
        } else {
            theAttributes["data-status"] = "inMildError";
        }
    } else if (iTorrent.status == 4) {
        theAttributes["data-status"] = "inDownload";
    } else if (iTorrent.percentDone != 1) {
        theAttributes["data-status"] = "iPause";
    }
    return theAttributes;
},
displayTorrents : function (iReq, iEvt) {
    if (iReq.readyState == 4) {
        if (iReq.status == 200) {
            try {
                this.lastResult = JSON.parse(iReq.responseText);
                if (this.lastResult.arguments && this.lastResult.arguments.torrents) {
                    var theTorrents = this.lastResult.arguments.torrents;
                    this.logger.pushResponse("Displaying " + theTorrents.length + " torrents.");
                    this.results.clearDisplay();
                    for (var i = 0; i < theTorrents.length; ++i) {
                        var theAttributes = this.getAttributes(theTorrents[i]);
                        theTorrents[i].result = theAttributes;
                        theTorrents[i].number = "" + (i + 1);
                        this.pushTorrent(theTorrents[i]);
                    }
                } else {
                    this.logger.pushResponse("No torrents returned.");
                }
            } catch (e) {
                console.log(e);
                this.logger.pushResponse("Error while getting status.");
            }
        } else {
            this.logger.pushResponse("Error " + iReq.status + " while getting status.");
        }
    }
},
getActive : function () {
    transmission(this,
                 "torrent-get",
                 {'fields': ['name', 'isFinished', 'percentDone', 'status', 'id', 'rateDownload', 'error', 'errorString']},
                 this.displayTorrents);
},
act : function (iArgs) {
    if (iArgs.length == 0) {
        this.getActive();
    } else {

    }
},
}

function Downloader(iLogger, iSearcher) {
    this.searcher = iSearcher;
    this.logger = iLogger;
}

Downloader.prototype = {
actionName : "dl",
help : function () {
    return "Usage: [number of torrent in last search] or [link to torrent]"
},
getTorrentName : function (iArg) {
    this.torrentName = null;
    var theNum = parseInt(iArg);
    if (theNum && theNum > 0) {
        if (this.searcher.lastResult && this.searcher.lastResult.length >= theNum) {
            this.torrentName = this.searcher.lastResult[theNum - 1].title;
            return this.searcher.lastResult[theNum - 1].link;
        }
    } else {
        this.torrentName = iArg;
        return iArg;
    }
},
act : function (iArgs) {
    if (!iArgs || iArgs == []){
        this.logger.pushResponse("Please specify the torrent you want to download.")
    }
    var theLink;
    if (typeof(iArgs) == "object") {
        theLink = this.getTorrentName(iArgs[0]);
    } else {
        theLink = this.getTorrentName(iArgs);
    }
    if (!this.torrentName) {
        this.logger.pushResponse("Invalid Torrent specified");
    }
    transmission(this,
                 "torrent-add",
                 {'filename' : theLink},
                 this.callback);
},
callback : function (iReq, iEvt) {
    if (iReq.readyState == 4) {
        if (iReq.status == 200) {
            try {
                this.logger.pushResponse("Successfully started torrent '" + this.torrentName + "'.");
            } catch(e) {
                console.log(e);
                this.logger.pushResponse("Error while launching the download.");
            }
        } else {
            this.logger.pushResponse("Error " + iReq.status + " encountered while launching the download.");
        }
    }
},
}

function TorrentActor(iLogger, iReporter, iAction) {
    this.logger = iLogger;
    this.reporter = iReporter;
    this.actionName = iAction;
}

TorrentActor.prototype = {
help : function () {
    return "Usage: [torrent number of last status report]";
},
sendReq : function (iId) {
    transmission(this,
                 "torrent-" + this.actionName,
                 {'id': iId},
                 this.callback);
},
act : function (iArgs) {
    if (!this.reporter.lastResult) {
        this.logger.pushResponse("Please make a status request before acting so rashly.");
        return;
    }
    var theNum = parseInt(iArgs[0]);
    if (theNum && theNum > 0) {
        var theTorrent = this.reporter.lastResult.arguments.torrents[theNum - 1];
        if (!theTorrent) {
            this.logger.pushResponse("Invalid torrent specified.")
        } else {
            this.sendReq(theTorrent.id);
        }
    } else {
        this.logger.pushResponse("Invalid torrent specified.")
    }
},
callback : function (iReq, iEvt) {
    if (iReq.readyState == 4) {
        if (iReq.status == 200) {
            try {
                this.logger.pushResponse("Action successful.");
            } catch(e) {
                console.log(e);
                this.logger.pushResponse("Error encountered.");
            }
        } else {
            this.logger.pushResponse("Error " + iReq.status + " encountered.");
        }
    }
},
}

function TorrentRemover(iLogger, iReporter) {
    this.logger = iLogger;
    this.reporter = iReporter;
}

TorrentRemover.prototype = new TorrentActor();
TorrentRemover.prototype.actionName = "remove";
TorrentRemover.prototype.constructor = TorrentRemover;
TorrentRemover.prototype.sendReq = function (iId) {
    this.reporter.lastResult = null;
    TorrentActor.prototype.sendReq.call(this, iId);
}