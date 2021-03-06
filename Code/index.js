
'use strict';
var APP_ID = process.env.appID;

//SETUP REFERENCES - The AlexaSkill prototype and https helper function

var AlexaSkill = require('./AlexaSkill');
var https = require('https');

var MyGmail = function () {
    AlexaSkill.call(this, APP_ID);
};

// EXTEND AlexaSkill
MyGmail.prototype = Object.create(AlexaSkill.prototype);
MyGmail.prototype.constructor = MyGmail;

MyGmail.prototype.eventHandlers.onSessionStarted = function (sessionStartedRequest, session) {
    //erase google drive files from old sessions (any images from "show me").
    var myToken=session.user.accessToken;
    var postData = "{'function':'deleteFiles','parameters':['"+myToken+"']}";
    runScripts (postData, session, function scriptCallback(){
    });
};    

//if no intent was stated, then default to the review intent

MyGmail.prototype.eventHandlers.onLaunch = function (launchRequest, session, response) {
    if(!session.user.accessToken){
	makeResponse(session,response,2);
    } else{
	var intent={
      "name": "ReviewIntent",
      "slots": {
        "fromFilter": {
          "name": "fromFilter"
        },
        "subjectFilter": {
          "name": "subjectFilter"
        },
        "readFilter": {
          "name": "readFilter",
          "value": "new"
        },
        "dateFilter": {
          "name": "dateFilter"
        }
      }
	};
	checkpin (intent,session, response);}
};

MyGmail.prototype.eventHandlers.onSessionEnded = function () {
};

//CONNECT INTENTS TO THE FUNCTIONS THAT WILL HANDLE THEM

MyGmail.prototype.intentHandlers = {
   "CountIntent": function (intent, session, response) {
       checkpin(intent, session,response);
    },
    "ReviewIntent": function (intent, session, response) {
        checkpin(intent, session,response);
    },
    "AMAZON.NextIntent": function (intent, session, response) {
        checkpin(intent, session,response);
    },
    "AMAZON.PreviousIntent": function (intent, session, response) {
 	    checkpin(intent, session,response);
    },
    "GoToMessageIntent": function (intent, session, response) {
 	    checkpin(intent, session,response);
    },
    "DetailsIntent": function (intent, session, response) {
        checkpin(intent, session,response);
    },
    "MarkReadIntent": function (intent, session, response) {
 	    checkpin(intent, session,response);
    },
    "MarkUnReadIntent": function (intent, session, response) {
     	checkpin(intent, session,response);
    },
    "StarIntent": function (intent, session, response) {
 	    checkpin(intent, session,response);
    },
    "UnStarIntent": function (intent, session, response) {
     	checkpin(intent, session,response);
    },
    "DeleteIntent": function (intent, session, response) {
        checkpin(intent, session,response);
    },
    "RefreshIntent": function (intent, session, response) {
        checkpin(intent, session,response);
    },
    "ReplyIntent": function (intent, session, response) {
        checkpin(intent, session,response);
    },
    "ReplyAllIntent": function (intent, session, response) {
        checkpin(intent, session,response);
    }, 
    "ListAttachmentsIntent": function (intent, session, response) {
        checkpin(intent, session,response);
    },
    "AMAZON.HelpIntent": function (intent, session, response) {
        helpTheUser(intent, session, response);
    },
    "AMAZON.StopIntent": function (intent, session, response) {
	    makeResponse(session,response,28);
    },
    "AMAZON.CancelIntent": function (intent, session, response) {
        makeResponse(session,response,28);
    },
   "AMAZON.RepeatIntent": function (intent, session, response) {
 	    makeResponse(session, response,29);
    },
    "AMAZON.YesIntent": function (intent, session, response) {
 	    questionYesHandler(intent, session, response);
    },
    "AMAZON.NoIntent": function (intent, session, response) {
 	    questionNoHandler(intent, session, response);
    },
    "ShowMeIntent": function (intent, session, response) {
 	    checkpin(intent, session,response);
    },   
    "AMAZON.StartOverIntent": function (intent, session, response) {
     	checkpin(intent, session, response);
    },
    "HelpWithSlotIntent": function (intent, session, response) {
 	    helpTheUser(intent, session, response);
    },
    "SetPINIntent": function (intent, session, response) {
        checkpin(intent,session,response);
    },
    "SayPINIntent": function (intent, session, response) {
        checkpin(intent,session,response);
    },
    "ClearPINIntent": function (intent, session, response) {
        checkpin(intent,session,response);
    },
    "WaitIntent":function (intent, session, response) {
        checkpin(intent,session,response);
    }
};


//User has asked how many messages match certain criteria (or how many on the current list)
function getCount (intent, session, response) {
//initialize session attributes and some needed variables.
	session.attributes.lastIntent="";
	var myFilter; //will hold value for label (new,old,all,starred) on messages to search.
    var searchString=""; //will hold the rest of the search parameters, if any.
    var query="&q=in:inbox"; //holds the query string in gMail API format;
    var useExistingList=false;
    var myPath = "/gmail/v1/users/me/messages";
    
//check for filters on the intent:
    var readSlot=intent.slots.readFilter.value;
    var dateSlot=intent.slots.dateFilter.value;
    //if no previous filter was saved in session attributes and no search is requested now, default to new messages:
    if(!readSlot&&!session.attributes.readFilter&&!session.attributes.searchString)
    {
        if(!intent.slots.fromFilter.value&&!intent.slots.subjectFilter.value&&!dateSlot){myFilter=' new';}
        else {myFilter="";}
    }
    //if the user only asked how many messages do I have while already working a list, assume the same list)
    //assume they are asking about the same list they are working with: 
    else {
		    if(!readSlot&&!intent.slots.subjectFilter.value&&!intent.slots.fromFilter.value&&!dateSlot){
		        useExistingList=true;
		    } 
	    }
    //if something is in the intent slot, standardize the word choices the user had:
    if(readSlot){
	        if(readSlot.match('read')||readSlot.match('old')){myFilter=' old';}       
	        if(readSlot.match('unread')||readSlot.match('new')){myFilter=' new';}
	        if(readSlot=='all'||readSlot=='total'){myFilter=' total';}
	        if(readSlot.match('starred')||readSlot.match('important')){myFilter=' starred';}    
        }
    if(!myFilter){myFilter="";}
    //handle the date, recorded by Alexa as P[yY][mM][dD][T[hH][mM][s[.s]S]] where lower case is a number. we will convert it all //to days for ease of searching gmail, and will throw errors for anything lower than that.
    if(dateSlot){
		    searchString = " sent in the last";
		    var daycounter=0;
		    var lastItem;
		    var errFlag;
		    var testItem;
		    for (var indexer = 0; indexer < dateSlot.length; indexer++) 
		    {
		        testItem = dateSlot.substr(indexer,1);
        		if(isNaN(testItem))
		        {
        			switch(testItem)
            			{
				case 'P':
					break;
				case 'Y':
					if(lastItem == 1){searchString=searchString+" year";}
					else{searchString=searchString+" "+lastItem+" years";}
					daycounter=daycounter+lastItem*365;
					break;	
				case 'M':
					if(lastItem == 1){searchString=searchString+" month";}
					else{searchString=searchString+" "+lastItem+" months";}
					daycounter=daycounter+lastItem*30;
					break;
				case 'W':
					if(lastItem == 1){searchString=searchString+" week";}
					else{searchString=searchString+" "+lastItem+" weeks";}
					daycounter=daycounter+lastItem*7;
					break;
				case 'D':
					if(lastItem == 1){searchString=searchString+" day";}
					else{searchString=searchString+" "+lastItem+" days";}
					daycounter=daycounter+lastItem;
					break;
				case 'H':
					errFlag=true;
					break;
				case 'T': 
					errFlag=true;
					break;
				default:
					errFlag=true;
				}
			        lastItem=testItem;
        		} else
		            {
			if(isNaN(lastItem)){lastItem=testItem;}
			else{lastItem = parseInt(lastItem.toString()+testItem.toString());}
		}
		        if(errFlag)
        			{
				session.attributes.helpContext=2;
				session.attributes.tmpreadFilter="";
				session.attributes.tmpsearchString="";
				session.attributes.tmpmessageList="";
				makeResponse(session,response,1);
			}
		    }
	        query = query+"%20newer_than:"+daycounter+"d";
	    }
    //get the rest of the search parameters
    if(intent.slots.fromFilter.value){
	        searchString=searchString+" from "+intent.slots.fromFilter.value;
	        query = query+"%20from:"+intent.slots.fromFilter.value;
	    }
    if(intent.slots.subjectFilter.value){
	        searchString=searchString+" about "+intent.slots.subjectFilter.value;
	        query = query +"%20subject:"+intent.slots.subjectFilter.value;
	    }
    //If the filter has changed, get a new message list.
    var filterTester="";
    var searchTester="";
    if(session.attributes.readFilter){filterTester=session.attributes.readFilter;}
    if(session.attributes.searchString){searchTester=session.attributes.readFilter;}    
	if(myFilter==filterTester&&searchString==searchTester){useExistingList=true;}
	if(!searchString){searchString="";}
	if(!useExistingList){
        switch(myFilter){
            case ' new':
                query=query + "%20is:unread";
                break;
            case ' old':
                query=query +"%20is:read";
                break;
		    case ' starred':
		        query = query +"%20is:starred";
		        break;
                default:
             }
	//make the actual call to google API
   	   getGmail(myPath,query,session, function mailResponseCallback(err, mailResponse) {
        	if (err) {
		//error getting messages
	    		if(err=="Error: 401"){
				makeResponse(session,response,2);
			    } else {
			            session.attributes.helpContext=3;
			            makeResponse(session,response,3);
        		 } 
        	} else 
        	{	
        	    if(mailResponse.resultSizeEstimate>0){	//message list returned
            	    session.attributes.tmpreadFilter=myFilter;
		            session.attributes.tmpsearchString = searchString;
		            session.attributes.tmpmessageList=mailResponse;
		            session.attributes.tmpQuery=query;
			        session.attributes.helpContext=12;
	    	        makeResponse(session,response,4);
        	    } else {	//no messages found        	    
        	        session.tmpreadFilter="";
        	        session.attributes.tmpsearchString = "";
		            session.attributes.tmpmessageList="";
		            session.attributes.tmpQuery="";
        	        if(myFilter==' total'){myFilter='';}
        	        if(session.attributes.messageList){session.attributes.helpContext=2;}
        	        else {session.attributes.helpContext=1;}
			        makeResponse(session,response,5,myFilter,searchString);
        	       }
        	}
    	   });
	} else //user asked for a count of the same list already being reviewed
	{
		session.attributes.helpContext=5;
		session.attributes.tmpreadFilter="";
		session.attributes.tmpsearchString="";
		session.attributes.tmpmessageList="";
		session.attributes.tmpQuery="";
		makeResponse(session,response,6);

    }
}
    
function getSummary (intent, session, response) {
//	handles many intents - this finds and reads summary of each message
//initialize variables
    var myFilter=""; //will hold value for selection of new,old,starred or all messages.
	var searchString=""; //will hold the rest of the search parameters, if any.
	var query="&q=in:inbox"; //holds the query string in gMail API format, skil only searches inbox for now
	var useExistingList=false; //determines whether a new call to google for a message list is needed.
	var myIndex=session.attributes.messageIndex;
	    if(!myIndex){myIndex=0;}
	var name=intent.name;
	var myPath, messageID, messageList; //params for gmail http calls
//process AMAZON.NextIntent, AMAZON.PreviousIntent, GoToMessageIntent indexing changes + error handling
    if(name=='AMAZON.NextIntent'||name=='AMAZON.PreviousIntent'||name=='GoToMessageIntent'){
        useExistingList=true;
        if(!session.attributes.messageList){ //if there is no message list but user is asking to move around one
            session.attributes.helpContext=4;
            makeResponse(session,response,7); //response prompts user to check messages first.
        } else {
            switch(name){
                case 'AMAZON.NextIntent':
                    ++myIndex;
                    break;
                case 'AMAZON.PreviousIntent':
        	        --myIndex;
        	        break;
                case 'GoToMessageIntent':
        	        if(!intent.slots.messagenumber.value){
        	            session.attributes.helpContext=6;
        	            makeResponse(session,response,10,'outofbounds')}
        		    else{myIndex=intent.slots.messagenumber.value-1;}
            	    break;
                default:
    	    }
        }
    }
	//handle stored info if this was called from getCount function
	if(session.attributes.tmpmessageList){
		if(name=='AMAZON.YesIntent'){			//user wants to use the new search
			session.attributes.readFilter=session.attributes.tmpreadFilter;
			session.attributes.searchString=session.attributes.tmpsearchString;
			session.attributes.messageList= session.attributes.tmpmessageList; 
			session.attributes.lastQuery = session.attributes.tmpQuery;
			myIndex = 0;
			useExistingList=true;
			session.attributes.messageIndex=0;
		} else {  					//user said anything but yes after search in getCount
			//if user said anything that can't be a new search:
			if(name!='ReviewIntent'&&name!='RefreshIntent'){
			    useExistingList=true;
			}
		}
		session.attributes.tmpreadFilter="";
		session.attributes.tmpsearchString="";
		session.attributes.tmpmessageList="";
		session.attributes.tmpQuery="";
	} else {
		if(name=='ReviewIntent'){ 	//all other intents use existing filters and can skip this.  
			//check for filters on the intent:
    		var readSlot=intent.slots.readFilter.value;
			var dateSlot=intent.slots.dateFilter.value;
			//if no previous filter and no search is requested now, default to new messages:
			if(!readSlot&&!session.attributes.readFilter&&!session.attributes.searchString) //no previous filter and nothing in "new/old/starred"
			{
    			if(!intent.slots.fromFilter.value&&!intent.slots.subjectFilter.value&&!dateSlot){ //no other search params
    			    myFilter=' new';}
                else { //no old search, but there is something searched besides "new/old/starred." Assume this means all
                    myFilter=" total";}
    		}
			//if something is in the intent slot, standardize the word choices the user had:
			if(readSlot){
				if(readSlot.match('read')||readSlot.match('old')){myFilter=' old';}       
				if(readSlot.match('unread')||readSlot.match('new')){myFilter=' new';}
				if(readSlot=='all'||readSlot=='total'){myFilter=' total';}
				if(readSlot.match('starred')||readSlot.match('important')){myFilter=' starred';}    
			}
			if(!myFilter){myFilter=" total";}
			switch(myFilter){
                	case ' new':
                    	query=query + "%20is:unread";
                    	break;
                	case ' old':
			           	query=query +"%20is:read";
						break;
					case ' starred':
						query = query +"%20is:starred";
						break;
						default:
             	}
			//handle the date, recorded by Alexa as P[yY][mM][dD][T[hH][mM][s[.s]S]]
			//where lower case is a number. convert it all to days.
			if(dateSlot){
				searchString = " sent in the last";
				var daycounter=0;
				var lastItem;
				var errFlag;
				var testItem;
				for (var indexer = 0; indexer < dateSlot.length; indexer++) {
					testItem = dateSlot.substr(indexer,1);
					if(isNaN(testItem)){
						switch(testItem){
							case 'P':
								break;
							case 'Y':
    							if(lastItem == 1){searchString=searchString+" year";}
								else{searchString=searchString+" "+lastItem+" years";}
								daycounter=daycounter+lastItem*365;
								break;	
							case 'M':
								if(lastItem == 1){searchString=searchString+" month";}
								else{searchString=searchString+" "+lastItem+" months";}
								daycounter=daycounter+lastItem*30;
								break;
							case 'W':
								if(lastItem == 1){searchString=searchString+" week";}
								else{searchString=searchString+" "+lastItem+" weeks";}
								daycounter=daycounter+lastItem*7;
								break;
							case 'D':
								if(lastItem == 1){searchString=searchString+" day";}
								else{searchString=searchString+" "+lastItem+" days";}
								daycounter=daycounter+lastItem;
								break;
							case 'T':
								errFlag=true;
								break;
							default:
								errFlag=true;
							}
						lastItem=testItem;
					} else {
						if(isNaN(lastItem)){lastItem=testItem;}
						else{lastItem = parseInt(lastItem.toString()+testItem.toString());}
					}
					if(errFlag) {
					    if(!session.attributes.messageList){session.attributes.helpContext=1;}
					    else{session.attributes.helpContext=2;}
						makeResponse(session,response,1);
					}
				}
				query = query+"%20newer_than:"+daycounter+"d";
				}
				//get the rest of the search parameters
				if(intent.slots.fromFilter.value){
					searchString=searchString+" from "+intent.slots.fromFilter.value;
					query = query+"%20from:"+intent.slots.fromFilter.value;
				}
				if(intent.slots.subjectFilter.value){
					searchString=searchString+" about "+intent.slots.subjectFilter.value;
					query = query +"%20subject:"+intent.slots.subjectFilter.value;
				}
			} //end of if statement that started the search for intent filters
		} //end of else statement about tmp stored strings
	
//If there is no existing message list, user asked for a refresh, or the filter has changed, get a new message list.
//set variables to help with undefined comparing to ""
    if(session.attributes.messageList){
        messageList=session.attributes.messageList;
        if(!myFilter&&!searchString){
	        myFilter=session.attributes.readFilter;
		    searchString=session.attributes.searchString;
	    }
    }
    var filterTester="";
    var searchTester="";
    if(session.attributes.readFilter){filterTester=session.attributes.readFilter;}
    if(session.attributes.searchString){searchTester=session.attributes.readFilter;}    
	if(myFilter==filterTester&&searchString==searchTester&&messageList){useExistingList=true;}
	if(intent.name=='RefreshIntent'){
	    useExistingList=false;
	    myFilter=session.attributes.readFilter;
	    searchString=session.attributes.searchString;
	    query=session.attributes.lastQuery;
	}
	if(!searchString){searchString="";}
	if(!myFilter){myFilter="";}
	if(!useExistingList){
		//make the actual call to google API
		myPath = "/gmail/v1/users/me/messages";
		session.attributes.lastQuery=query;
		session.attributes.messageIndex = 0;
   	   	session.attributes.attachments="";
    	session.attributes.currentMessage="";
    	session.attributes.messageList="";
    	session.attributes.readFilter = myFilter;
		session.attributes.searchString = searchString;
   	   	getGmail(myPath,query,session, function mailResponseCallback(err, mailResponse) {
            if (err) {
	    		if(err=="Error: 401"){
					makeResponse(session,response,2); //user needs to link account
				} else { //some other error getting info back from Google
    	    		session.attributes.helpContext=3;
            		makeResponse(session,response,3);
        		} 
        	} else {
			//successfully got the new list, start the speech responses and handle zero length.
        		if(mailResponse.resultSizeEstimate===0){
					if(!session.attributes.messageList){session.attributes.helpContext=1;}
					else{session.attributes.helpContext=2;}
					makeResponse(session,response,5,myFilter,searchString);
        	    } else {
        	        	var subject;
                        var date;
                        var from,x;
                        var tmpfrom="";
        	        session.attributes.messageList = mailResponse;
				    //call gmail again for first message
				    messageID=mailResponse.messages[0].id;
				    query="&format=METADATA";
				    myPath = "/gmail/v1/users/me/messages/"+messageID;
				    getGmail(myPath,query,session, function mailResponseCallback2(err2, mailResponse2) {
       				    if (err2) {
	    				    if(err2=="Error: 401"){
                                makeResponse(session,response,2); //user need to re-link account
					        } else {
					            session.attributes.helpContext=3;
					            session.attributes.currentMessage="";
					            makeResponse(session,response,3);
        			        } 
        			    } else { //read first message.
        			        if(!mailResponse2){
        			            session.attributes.helpContext=3;
    	        			    session.attributes.currentMessage="";
    	        			    makeResponse(session,response,3);
        			        }
						    for (var headerIndex = 0; headerIndex < mailResponse2.payload.headers.length; headerIndex++) {
				                switch(mailResponse2.payload.headers[headerIndex].name){
                				    case 'Subject':
                    				    subject = makereadable(mailResponse2.payload.headers[headerIndex].value);
                        				break;
                    				case 'From':
                    				    from = makereadable(mailResponse2.payload.headers[headerIndex].value).split(" ");
                    				    if(from.length==1){
                    				        tmpfrom = from[0];
                    				    }
                    				    else{
                    				        for (x in from){
                    				            if(from[x].indexOf("@")==-1){tmpfrom=tmpfrom+" "+from[x];}
                    				        }
                    				    }
                    				    from = tmpfrom;
                 	   	    			break;
                			    	case 'Date':
                    			    	let tmpdate = new Date(mailResponse2.payload.headers[headerIndex].value);
                    			    	date = tmpdate.toDateString();
                    			    	let today= new Date();
                    			    	if(date==today.toDateString()){date="today";}
                    			    	today.setDate(today.getDate() - 1);
                                        if(today.toDateString()==date){date='yesterday';}
                    			    	//remove any leading zero from the day to correct Alexa speech quirk.
                    			    	if(date.charAt(8)=='0'){date=date.replace("0", "");}
                    					break;
            	       				default:
    				    		}
               		        }
		        	        session.attributes.helpContext=6;
  			        	    session.attributes.readFilter=myFilter;
  			        	    session.attributes.searchString=searchString;
			                session.attributes.currentMessage={"id":messageID,"from":from,"date":date,"subject":subject};
                			makeResponse(session,response,8);
                    	}
                    });
        	    }
        	}
        });
    }
    else {
    //just use the existing message list, but get another message;

    var problem="";
	var listlength=messageList.resultSizeEstimate;
	//circle back and error check for valid message index (incremented/decremented above but no err check)
    if(myIndex>=listlength&&name==='AMAZON.NextIntent'){problem = 'reachedend';}
    if(myIndex<0&&name==='AMAZON.PreviousIntent'){problem = 'reachedfirst';}
    if(name==='GoToMessageIntent'){
        if(myIndex<0||myIndex>listlength){problem = 'outofbounds';}
    }
	session.attributes.helpContext=6;
    if(problem){makeResponse(session,response,10,problem);}
    else{
    messageID=messageList.messages[myIndex].id;
	myPath = "/gmail/v1/users/me/messages/"+messageID;
	query="&format=METADATA";
	getGmail(myPath,query,session, function mailResponseCallback3 (err, mailResponse) {
	    	var subject;
    var date;
    var from,x;
    var tmpfrom="";
    if (err) {
	    if(err=="Error: 401"){
            makeResponse(session,response,2);
		} else {
    	   session.attributes.helpContext=3;
    	   session.attributes.currentMessage="";
    	   session.attributes.messageIndex=myIndex;
            makeResponse(session,response,3);
            } 
        } else { //read first message.
        if(!mailResponse){
    	   session.attributes.helpContext=3;
    	   session.attributes.currentMessage="";
    	   session.attributes.messageIndex=myIndex;
            makeResponse(session,response,3);  
        } else {
		    for (var headerIndex = 0; headerIndex < mailResponse.payload.headers.length; headerIndex++) {
			switch(mailResponse.payload.headers[headerIndex].name){
                case 'Subject':
                    subject = makereadable(mailResponse.payload.headers[headerIndex].value);
                	break;
                case 'From':
                	from = makereadable(mailResponse.payload.headers[headerIndex].value).split(" ");
                    				    if(from.length==1){
                    				        tmpfrom = from[0];
                    				    }
                    				    else{
                    				        tmpfrom="";
                    				        for (x in from){
                    				            if(from[x].indexOf("@")==-1){tmpfrom=tmpfrom+" "+from[x];}
                    				        }
                    				    }
                    from = tmpfrom;
                    break;
                case 'Date':
                	let tmpdate = new Date(mailResponse.payload.headers[headerIndex].value);
                    date = tmpdate.toDateString();
                    let today= new Date();
                    if(date==today.toDateString()){date="today";}
                    today.setDate(today.getDate() - 1);
                    if(today.toDateString()==date){date='yesterday';}
                    //remove any leading zero from the day to correct Alexa speech quirk.
                    if(date.charAt(8)=='0'){date=date.replace("0", "");}
                    break;
            	default:
    		}
        }
		    var postData = "{'function':'modifyMsg','parameters':['"+messageID+"','MarkReadIntent']}";
            runScripts (postData, session, function scriptCallback(){});
      		session.attributes.messageIndex=myIndex;
      		session.attributes.attachments="";
  	    	session.attributes.currentMessage={"id":messageID,"from":from,"date":date,"subject":subject};
  	    	session.attributes.helpContext=6;
            makeResponse(session,response,9);
        }
        }
    });
    }
    }
}

function messageDetails(intent, session, response){
    var messageID=session.attributes.currentMessage.id;
    if(!messageID){
        session.attributes.helpContext=4;
        makeResponse(session,response,7);
    } else {
         var postData = "{'function':'getPlainBody','parameters':['"+messageID+"']}";
        runScripts (postData, session, function scriptCallback(err,scriptResponse){
     	    if (err) {
    			session.attributes.helpContext=3; //alert user to error
    			makeResponse(session,response,3);
	    	} else {
	            var resp;
	       	    try{
    		        resp=JSON.parse(scriptResponse).response.result;
				    var plainResponse=makereadable(resp);
				    session.attributes.helpContext=7;
    			    makeResponse(session,response,11,plainResponse);
	       		} catch(e){
		            session.attributes.helpContext=3;
    				makeResponse(session,response,3);
		        }
	       	}
        });
    }
}
    
function modifyMessage(intent, session, response){
    var postData;
    var messageID;
    if(session.attributes.currentMessage){messageID=session.attributes.currentMessage.id;}
    if(!messageID){
        session.attributes.helpContext=4;
        makeResponse(session,response,7);
    }
	else{
        session.attributes.helpContext=6;
	    postData = "{'function':'modifyMsg','parameters':['"+messageID+"','"+intent.name+"']}";
	    runScripts (postData, session, function scriptCallback(err,scriptResponse){
		    if (err) {
			    session.attributes.helpContext=3;
                makeResponse(session,response,3);
		    } else {
		        var resp;
		        try{
                    resp=JSON.parse(scriptResponse).response.result;
			        if(resp=='OK'){
			            session.attributes.helpContext=6;
                	    makeResponse(session,response,12,intent.name);
				    } else {
				       	session.attributes.helpContext=3;
                        makeResponse(session,response,3);
				    }
		        } catch(e){
				    session.attributes.helpContext=3;
                    makeResponse(session,response,3);
				}						  
			}
        });
	}
}
    
function replyMessage(intent, session, response){
    var postData;
    var replyslot;
    if(!session.attributes.currentMessage){
        session.attributes.helpContext=4;
        makeResponse(session,response,7);
    }
	else{
	     var messageID=session.attributes.currentMessage.id;
	    if(intent.name!='AMAZON.YesIntent'){
            replyslot = intent.slots.replymessage.value;
            if (!replyslot) {
                session.attributes.helpContext=8;
                makeResponse(session,response,13);
            } else {
                session.attributes.helpContext=9;
                session.attributes.lastIntent=intent;
                var FnName;
            if(session.attributes.lastIntent.name=='ReplyIntent'){FnName = 'sendReply';}
            if(session.attributes.lastIntent.name=='ReplyAllIntent'){FnName = 'sendReplyAll';}
            session.attributes.postData = "{'function':'"+FnName+"','parameters':['"+messageID+"','"+replyslot+"']}";
                makeResponse(session,response,14,replyslot);
            }
	    } else {    
            postData = session.attributes.postData;
            session.attributes.postData = "";
            session.attributes.lastIntent="";
	        runScripts (postData, session, function scriptCallback(err,scriptResponse){	         
			    if (err) {
            		session.attributes.helpContext=3;
            		makeResponse(session,response,3);
		        } else {
		            var resp;
		            try{
            	       resp=JSON.parse(scriptResponse).response.result;
				        if(resp=='OK'){
					        session.attributes.helpContext=6;
						    makeResponse(session,response,15);
						} else {
						    session.attributes.helpContext=3;
            		        makeResponse(session,response,3);
						}
		            } catch(e){
		                session.attributes.helpContext=3;
    		            makeResponse(session,response,3);
		            }
			    }
            });
	    }
    }
}

function listAttachments(intent, session, response){
//handles ListAttachmentsIntent and the yes intent after question about listing in more detail.
    if(intent.name=='ListAttachmentsIntent'){
    	if(!session.attributes.currentMessage){
       		session.attributes.helpContext=4;
		    makeResponse(session,response,7);
	    } else {
	        var messageID=session.attributes.currentMessage.id;
    	    var postData = "{'function':'getAttachments','parameters':['"+messageID+"']}";
    	    runScripts (postData, session, function scriptCallback(err,scriptResponse){
	            if (err) {
            		session.attributes.helpContext=3;
    			makeResponse(session,response,3);
	    	    } else {
		    	    var attachments;
			        try{
                        attachments=JSON.parse(scriptResponse).response.result;
                    	if(attachments.length===0){
            				session.attributes.attachments=["no attachments"];
			            	session.attributes.helpContext=6;
            				makeResponse(session,response,37);
                	  	 } else {
				            session.attributes.attachments = attachments;
            				session.attributes.helpContext=6;
			            	makeResponse(session,response,26);
			             }
			        } catch(e){
				        session.attributes.helpContext=3;
        				makeResponse(session,response,3);
		    	   }			     
		    }
            });
        }
    } else {
        session.attributes.helpContext=6;
	    makeResponse(session,response,27);
    }
}

function helpTheUser(intent, session, response){
	var cardTitle, cardContent, speechText,speechOutput,speakIndex;
	var context;
	var repromptOutput="You can say repeat that, show me, quit, or say wait, for more time.  What would you like to do?"; 
	if(intent.name=='HelpWithSlotIntent'){context=20;}
	else{context=session.attributes.helpContext;}
    switch(context){
	case 1: //search params error or none found, no existing message list
		session.attributes.helpContext = 30;
		speechOutput="If you want me to get all of your unread messages, say review my new messages.  To get everything, say review all my messages.  You can also search by any combination of whether the message has been read or not, who it is from, a word in the subject line, or how recently it was received. For some example searches, say help again. What would you like to do?";
		break;
	case 2: //search params error or none found, previous message list exists
		session.attributes.helpContext=30;
		speechText="<speak><p>Here are some things you can say.</p><p>To interrupt me, you can say Alexa, followed by a command.</p> <p>You can say things like, next message,</p><p>get my unread messages,</p><p> or review all my messages.</p> <p>You can also search by whether the message has been read</p>, <p>who it is from,</p> <p>a word in the subject line,</p> <p>or how recently it was received.</p> <p> For some example searches, say help again.</p> What would you like to do?</speak>";
		speechOutput={speech:speechText,type:'SSML'};
        break;
	case 3: //http error other than authorization issue.
		speechOutput="I had trouble contacting G Mail to process your most recent request.  You can try again, say other commands like check my email, or say quit to exit.  What would you like to do?";
		if(session.attributes.currentMessage){session.attributes.helpContext=6;}
	    else {session.attributes.helpContext=4;}
		break;
	case 4: //user asked for something that requires a message list first.
		session.attributes.helpContext=30;
		speechText='<speak><p>Here are some things you can say.</p><p>To interrupt me, you can say Alexa, followed by a command.</p><p> Before I can do anything else, I need to retrieve a list of your messages.</p><p> If you want me to get only your unread messages, say get my new messages.</p><p> For all of your new and previously <w role="ivona:VBD">read</w> messages, say review all my messages.</p><p> You can also search by whether the message has been read,</p><p> if you marked it as starred,</p><p> who it is from,</p><p> a word in the subject line,</p><p> or how recently it was received.</p><p> For some example searches, say help again.</p> What would you like to do?</speak>';  
		speechOutput={speech:speechText,type:'SSML'};
        break;
	case 5: //returned count of message list already under review.
		session.attributes.helpContext=30;
		speakIndex=session.attributes.messageIndex+1;
		speechText="<speak><p>Here are some things you can say.</p><p>To interrupt me, you can say Alexa, followed by a command.</p> <p> You can try a different search, or continue working with the current list.</p> <p>To hear the current message summary again, say go to message "+speakIndex+".</p><p> You can also say read more,</p><p> get the attachments,</p><p> erase this,</p><p> mark this unread,</p><p> mark this starred,</p><p> or remove the star.</p><p> If you would like example searches, say help again.</p> What would you like to do?</speak>";  
		speechOutput={speech:speechText,type:'SSML'};
        break;
	case 6: //options for working with a message or navigating the list.
	    speakIndex=session.attributes.messageIndex+1;
		speechText="<speak><p>Here are some things you can say.</p><p>To interrupt me, you can say Alexa, followed by a command.</p><p> To hear the most recent message summary again, say go to message "+speakIndex+".</p><p> You can also say read more,</p><p> get the attachments,</p><p> erase this,</p><p> mark this unread,</p><p> mark this starred,</p><p> or remove the star.</p><p> You can go to other messages on your list by saying next,</p><p> or previous,</p><p> or you can ask for a new search.</p><p> If you would like example searches, say help again.</p> What would you like to do?</speak>";
		speechOutput={speech:speechText,type:'SSML'};   
		session.attributes.helpContext=30;
        break;
	case 7: //Alexa is reading message details, possibly badly.
		speechOutput="Some messages are designed to look good, but are difficult for me to read.  If the message doesn’t sound right, you can say show me, to view it in the Alexa app. You can also say things like next message, say help again for more choices, or say quit to exit. What would you like to do?"; 
		session.attributes.helpContext=6;
		break;
	case 8: //help after saying reply, with empty slot
	    session.attributes.helpContext=6;
		speechText="<speak><p>I can send very simple replies, about one sentence long.</p><p>  I'll read your message and ask for your approval before I send anything.</p><p>  If you were not trying to reply, you can say a different command, or say help again for more choices.</p><p>  If you want to send a response, say reply, or reply all, followed by your short message.</p><p> What would you like to do?</speak>";
		speechOutput={speech:speechText,type:'SSML'};  
        break;
	case 9: //asked for help after being asked to confirm sending a reply
		speechOutput="You can say yes, to send this message.  If you need to correct it, say no, and try a new reply command.  You can also say a different command, or say quit if you're finished.  Would you like to send this message?";
        break;
	case 12: //Alexa found results in a new search when old list exists. Just asked user to confirm.
		session.attributes.helpContext=6; 
		if(session.attributes.tmpmessageList.resultSizeEstimate==1){
			speechOutput="You can say yes to start at the first message I just found, or say no to go back to the list you were reviewing.  For more choices, say help again. Would you like to review it?";
		} else {
			speechOutput="You can say yes to start at the first message I just found, or say no to go back to the list you were reviewing.  For more choices, say help again. Would you like to review them?";
		}
		break;	
	case 14: //help after question about attachments
		session.attributes.helpContext=6;
		speechOutput = "You can say yes, to hear the names and types of the attachments to this message, or say no to do something else. You can also say help again for more choices, or say quit, if you're finished.  Would you like me to list the attachments?";
		break;		
	case 15: //user said help after Alexa asked for confirmation of a message deletion.
		speechOutput="When you ask me to erase a message, it isn’t permanently erased.  I move it to an email folder called trash.  You can recover messages in the trash by accessing your email on a computer, tablet or phone.  Unless you have changed your mail settings, Google will erase messages left in the trash for more than thirty days.  To continue moving the current message to the trash folder, say yes.  Otherwise, say no. Do you want me to move this to the trash?";
		break;
	case 16:
	    if(session.attributes.messageList){session.attributes.helpContext=6;}
	    else {session.attributes.helpContext=4;}
		speechOutput="To set an access pin, say set my pin, followed by a 4 digit number.  For example, you can say set my pin to 1 2 3 4.  Otherwise, you can say review my messages to continue, say help again for more options, or say quit to exit.  What would you like to do?";
		break;
	case 17:
		session.attributes.helpContext=6;
		speechOutput="I can send images to the Alexa app, if they are less than 2 Megabytes in size, and of the type, jpeg, or p n g.  You will need to use another email device to view images that I can't display.  You can say something like next message, or say help again for more choices.  What would you like to do?";
		break;
	case 18: //wrong PIN
		speechOutput="Because you selected an access PIN, you won’t be able to use the skill without the PIN.  It should be a four digit number.  I sent a card to the Alexa app with instructions for resetting your PIN manually online.  If you know your PIN, you can say it now, or say quit to exit.  What is your access PIN?"; 
	    cardContent="Instructions for resetting your PIN are available online.  Please use a browser to go to email-skill.blogspot.com";
	    cardTitle="Help With My Email PIN Reset";
		break;
	case 19: //help after prompt to add a PIN
		speechOutput="Setting a four-digit PIN adds an extra layer of security to this skill, to prevent others with access to your Alexa device from reading your email.  This is optional, but once you do this,  you won’t be able to use the skill without the PIN.  If you say yes, I will help you set a PIN.  If you say no, I won't ask again, but you can add a PIN anytime by saying set my PIN.  Would you like to set a PIN now?"; 
	    break;
	case 20:
	    speechOutput = "Sorry.  I can't answer such specific questions, but whenever you say help, I'll try to give you an answer that explains what you are doing right then.  What else would you like to do?";
		if(session.attributes.messageList){session.attributes.helpContext=6;} 
		else {session.attributes.helpContext=4;}
		break;
	case 30: //user asked for example searches.
	    speechText="<speak><p>Here are some examples of how to search.</p><p> You can interrupt me any time by saying Alexa, followed by a command.</p>You can say things like, search for messages from Bob,<break time=\"700ms\"/>find all my messages about payment,<break time=\"700ms\"/> review unread messages from the last 2 weeks,<break time=\"700ms\"/>  get starred messages,<break time=\"700ms\"/> or search for messages about dinner, from Juan, received in the last 2 days.<break time=\"700ms\"/>  <p>There are many combinations, and it doesn't hurt anything to experiment.</p><p>  If you're not sure just give it a try, or say check my email, to get started.</p>  What would you like to do?</speak>";
	    speechOutput={speech:speechText,type:'SSML'};
	    break;
	default:  //user opened the skill with a request for help.
		speechOutput = "The Lucy skill lets you read, and manage your Google g mail using Alexa.  I sent a card to the Alexa app with a link to online instructions.  You can also say help while using the skill, for more specific coaching. To get started with your unread messages, you can say check my email, or you can say quit to exit. What would you like to do?";
	    cardContent="To connect your account, go to 'Skills and Games";
	    cardTitle="Link to the Luck Skill";
		if(session.attributes.messageList){session.attributes.helpContext=6;} 
		else {session.attributes.helpContext=4;}
	}
	session.attributes.lastSpeech=speechOutput;
	if(cardTitle){response.askWithCard(speechOutput, repromptOutput,cardTitle, cardContent);}
	else {response.ask(speechOutput,repromptOutput);}
}

function deleteConfirm(intent,session,response){
    var messageID;
    if(session.attributes.currentMessage){messageID=session.attributes.currentMessage.id;}
    if(!messageID){
	session.attributes.helpContext=4;
        makeResponse(session,response,7);
    }
	else{
	session.attributes.helpContext=15;
        makeResponse(session,response,30);
	}
}  

function questionYesHandler(intent, session, response){
    var speechOutput;
    switch (session.attributes.question){
        case 1: //would you like to review? (found messages)
            getSummary(intent,session,response);
            break;
		case 2: //confirm reply or reply all.  Send?
	        session.attributes.helpContext=6;
            replyMessage(intent,session,response);
            break;
        case 4: //close your email?
            speechOutput="Goodbye.";
            response.tell(speechOutput);
            break;
        case 5: //move this to the trash? confirm.
            session.attributes.helpContext=6;
            modifyMessage(intent,session,response);
            break;
        case 6: //list the attachments?
            listAttachments(intent,session,response);
            break;
        case 7: //set a PIN
            session.attributes.helpContext=16;
	        makeResponse(session,response,32);
	        break;
        default:
            makeResponse(session,response,34);
    }

}

function questionNoHandler(intent, session, response){
    switch (session.attributes.question){
        case 1: //would you like to review? (newly found messages)
             makeResponse(session,response,28);
            break;
        case 2: //confirm reply or reply all?
            makeResponse(session,response,35);
            break;
        case 4: //close your email?
		    makeResponse(session,response,35);
            break;        
        case 5: //delete?
            makeResponse(session,response,35);
            break;
        case 6: //list your attachments?
            makeResponse(session,response,35);
            break;
        case 7:  //set a PIN?
            setpin(intent,session,response);
            break;
        default:
		    makeResponse(session,response,34);
        }
}

//HANDLER FOR GET ACTIONS
function getGmail (myPath,query,session, mailResponseCallback) {
    let mytoken = session.user.accessToken;
    let options = {
		   host: 'www.googleapis.com',
		   path: myPath+"?access_token="+mytoken+query
	           }; 
    https.get(options, function (res) {
        let mailResponseString = '';
        if (res.statusCode != 200) {
	    if(res.statusCode === 401) {
		    return mailResponseCallback(new Error("401"));}
	    else {
            return mailResponseCallback(new Error("Non 200 Response"));
	    }
        }
        res.on('data', function (data) {
            mailResponseString += data;
        });
        res.on('end', function () {
            let mailResponseObject = JSON.parse(mailResponseString);
            if (mailResponseObject.error) {
                mailResponseCallback(new Error(mailResponseObject.error.message));
            } else {
                return mailResponseCallback(null, mailResponseObject);
            }
        });
    }).on('error', function (e) {
        return mailResponseCallback(new Error(e.message));
    });
}

//post handler to run Google Apps Scripts
function runScripts (postData, session,scriptCallback){
    var mytoken = session.user.accessToken;
    var scriptsID=process.env.scriptsID;
    var responseString="";
  	let options = {
	    host: "script.googleapis.com",
		method:"POST",
		headers: {
		    "Authorization":"Bearer "+mytoken,
		},
		path: "/v1/scripts/"+scriptsID+":run"
  	    };
	var req = https.request(options, function (res2) {
	 
        if (res2.statusCode != 200) {
            return scriptCallback(new Error("Non 200 Response"));
	    }
        res2.on('data', function (respdata) {
            responseString += respdata;
        });
        res2.on('end', function () {
    		return scriptCallback(null,responseString);
        });
    });
    req.on('error', function () {
        return scriptCallback(new Error("Non 200 Response"),null);
        });
    // write data to request body
    req.write(postData);
    req.end();
}

//Helper to make strings readable by Alexa
function makereadable(string){
    if(string.length>=7500){string=string.substr(0, 7499);}
	string = string.replace(/&amp/g,"&");
	string = string.replace(/ fwd:/," forward:");
	string = string.replace(/ re:/," reply:");
	string = string.replace(/&/g," and ");
    string = string.replace(/[^a-zA-Z0-9-*.,: @$]/g,"");
    string = string.replace(/\r?\n|\r/g, " ");
    return string;
 }
 
//checks if a pin is needed and/or provided correctly
function checkpin(intent,session, response){
    var myToken=session.user.accessToken;
    var mypin="";
    if(!session.attributes.pinok){
	    if(intent.name=='SayPINIntent'){
    	    if(!intent.slots.mypin.value){
        		session.attributes.helpContext=18;
		        makeResponse(session,response,42);
    	    } else {
       		    if(intent.slots.mypin.value.length!=4){
            		session.attributes.helpContext=18;
			        makeResponse(session,response,42);
        		} else {mypin=intent.slots.mypin.value;}
    	    }
	    }
   	    var postData = "{'function':'checkpin','parameters':['"+mypin+"','"+myToken+"']}";
		runScripts (postData, session, function scriptCallback(err,scriptResponse){
		    var resp;
		    if (err) {
			    session.attributes.helpContext=3;
			    makeResponse(session,response,3);
		    } else {
			    try {
				    resp=JSON.parse(scriptResponse).response.result;
		            switch(resp){
		            case 'locked':
	                    makeResponse(session,response,53);
	                    break;
        			case 'nomatch':
        			    if(intent.name=='SayPINIntent'){
    	    		        session.attributes.helpContext=18;
			    	        makeResponse(session,response,44,mypin);
    			        }
    			        else {
    			            session.attributes.lastIntent=intent;
    			            session.attributes.helpContext=18;
    				        makeResponse(session,response,43);
	    		        }
		        	    break;
	                case 'notset':
	                    session.attributes.pinok=true;
    	                if(intent.name=='SetPINIntent'){
	                        setpin(intent,session,response);
	                    } else {
	                        session.attributes.lastIntent=intent;
				            session.attributes.helpContext=19;
	                        makeResponse(session,response,45);
    	                }    
	    	            break;
		            case 'match':
			    	    session.attributes.pinok=true;
		      			//this section can't be reached midway through a session.  Switch actions are based on first intent.
            		    if(intent.name=='SayPINIntent'){
		                    intent=session.attributes.lastIntent;
		                }
		                switch(intent.name){
                        case 'CountIntent': //user asked How many... (change to default intro behavior)
            		        intent={
                                "name": "ReviewIntent",
                                "slots": {
                                    "fromFilter": {
                                        "name": "fromFilter"
                                    },
                                    "subjectFilter": {
                                    "name": "subjectFilter"
                                    },
                                    "readFilter": {
                                        "name": "readFilter",
                                        "value": "new"
                                    },
                                    "dateFilter": {
                                        "name": "dateFilter"
                                    }
                                }
	                         };
                            getSummary(intent,session,response);
                            break;
                        case 'ReviewIntent':
                            getSummary(intent,session,response);    
                            break;
                        case 'AMAZON.NextIntent':
                            getSummary(intent, session, response);
                            break;
                        case 'AMAZON.PreviousIntent':
             	            getSummary(intent, session, response);
 	                        break;
                        case 'RefreshIntent': //not a valid intent, so go to default behavior
		                    intent={
                                "name": "ReviewIntent",
                                "slots": {
                                    "fromFilter": {
                                        "name": "fromFilter"
                                    },
                                    "subjectFilter": {
                                      "name": "subjectFilter"
                                    },
                                    "readFilter": {
                                        "name": "readFilter",
                                         "value": "new"
                                    },
                                    "dateFilter": {
                                        "name": "dateFilter"
                                    }
                                }
	                        };
                            getSummary(intent,session,response);
                            break;
                        case 'AMAZON.StartOverIntent': 
            		        intent={
                                "name": "ReviewIntent",
                                "slots": {
                                    "fromFilter": {
                                        "name": "fromFilter"
                                    },
                                    "subjectFilter": {
                                      "name": "subjectFilter"
                                    },
                                    "readFilter": {
                                        "name": "readFilter",
                                         "value": "new"
                                    },  
                                    "dateFilter": {
                                        "name": "dateFilter"
                                    }
                                }
	                        };
                            getSummary(intent,session,response);
                            break;
                        case 'GoToMessageIntent':
                            getSummary(intent,session,response);
                            break;
                        case 'DetailsIntent':
                            messageDetails(intent, session, response);
                            break;
                        case 'MarkReadIntent':
 	                        modifyMessage(intent, session, response);
             	            break;
                        case 'MarkUnReadIntent':
 	                        modifyMessage(intent, session, response);
             	            break;
                        case 'StarIntent':
             	            modifyMessage(intent, session, response);
 	                        break;
                        case 'UnStarIntent':
 	                        modifyMessage(intent, session, response);
             	            break;
                        case 'DeleteIntent':
                            deleteConfirm (intent, session, response);
                            break;
                        case 'ReplyIntent':
                            replyMessage(intent, session, response);
                            break;
                        case 'ReplyAllIntent':
                            replyMessage(intent, session, response);
                            break;

                        case 'ListAttachmentsIntent':
                            listAttachments(intent, session, response);
                            break;
                        case 'WaitIntent':
                            makeResponse(session,response,54);
                            break;
                        default: //should not be able to get here, but added to handle unexxpected errors
                            intent={
                                    "name": "ReviewIntent",
                                    "slots": {
                                        "fromFilter": {
                                            "name": "fromFilter"
                                        },
                                        "subjectFilter": {
                                          "name": "subjectFilter"
                                        },
                                        "readFilter": {
                                            "name": "readFilter",
                                             "value": "new"
                                        },
                                        "dateFilter": {
                                            "name": "dateFilter"
                                        }
                                    }
	                            };
                            getSummary(intent,session, response); 
                        }
                        break;
                    default:
        				session.attributes.helpContext=3;
		        		makeResponse(session,response,3);
		            }
		        } catch(e){
				    session.attributes.helpContext=3;
			    	makeResponse(session,response,3);
			    }
		    }
        });
    }
    else {
	//this handles intents during a session, when PIN was already OK.
        switch(intent.name){
            case 'CountIntent':
                getCount(intent, session, response);
                break;
            case 'ReviewIntent':
                getSummary(intent,session,response);    
                break;
            case 'AMAZON.NextIntent':
                getSummary(intent, session, response);
                break;
            case 'AMAZON.PreviousIntent':
 	            getSummary(intent, session, response);
 	            break;
 	        case 'GoToMessageIntent':
 	            getSummary(intent, session, response);
 	            break;
            case 'RefreshIntent': 
                getSummary(intent, session, response);
                break;

            case 'AMAZON.StartOverIntent':
                intent={
                                "name": "GoToMessageIntent",
                                "slots": {
                                    "messagenumber": {
                                        "name": "messagenumber",
                                         "value": "1"
                                    }
                                }
	                        };
                getSummary(intent,session,response);
                break;
            case 'SetPINIntent':
                setpin(intent,session,response);
                break;
            case 'ClearPINIntent':
                setpin(intent,session,response);
                break;
	        case 'SayPINIntent':
		        makeResponse(session,response,48);
                break;
            case 'DetailsIntent':
                messageDetails(intent, session, response);
                break;
            case 'MarkReadIntent':
 	            modifyMessage(intent, session, response);
 	            break;
            case 'MarkUnReadIntent':
 	            modifyMessage(intent, session, response);
 	            break;
            case 'StarIntent':
 	            modifyMessage(intent, session, response);
 	            break;
            case 'UnStarIntent':
 	            modifyMessage(intent, session, response);
 	            break;
            case 'DeleteIntent':
                deleteConfirm (intent, session, response);
                break;
            case 'ReplyIntent':
                replyMessage(intent, session, response);
                break;
            case 'ReplyAllIntent':
                replyMessage(intent, session, response);
                break;

            case 'ListAttachmentsIntent':
                listAttachments(intent, session, response);
                break;
            case 'WaitIntent':
                makeResponse(session,response,54);
                break;
            default:
                getCount(intent, session, response);
            }
        }
}

function setpin(intent,session,response){
    var mypin="";   
    if(intent.name=='SetPINIntent'){ //user said "set my PIN..."
        if(!intent.slots.mypin.value) { //Alexa did not understand the number
		    session.attributes.helpContext=16;
            makeResponse(session,response,50);
            } else {
                if(intent.slots.mypin.value.length !=4){ //was not a 4-digit number
		            session.attributes.helpContext=16;
                    makeResponse(session,response,50);                    
                } else {mypin=intent.slots.mypin.value;} //spoen PIN is OK
            }
    } else {mypin='notneeded';} //user got here by saying "no" to "set a PIN?" Skill still sets a file to reflect none is needed
    var postData = "{'function':'setpin','parameters':['"+mypin+"']}";
	runScripts (postData, session, function scriptCallback(err,scriptResponse){ //call script to set a PIN file
	    if (err) {
			session.attributes.helpContext=3;
			makeResponse(session,response,3);
	    } else {
	        try {
	            var resp=JSON.parse(scriptResponse);
	            if(resp.response.result){
    		    switch (intent.name){ //make response based on how user got here
        		    case 'SetPINIntent':
        		        if(session.attributes.messageList){session.attributes.helpContext=6;}
        		        else {session.attributes.helpContext=4;}
		                makeResponse(session,response,51,mypin); //confirm user PIN
		                break;
    		        case 'ClearPINIntent':
    		            if(session.attributes.messageList){session.attributes.helpContext=6;}
        		        else {session.attributes.helpContext=4;}
                        makeResponse(session,response,52); //confirm PIN was cleared
		                break;
		            case 'AMAZON.NoIntent': //user got here by saying no when asked about setting a PIN
	                    intent=session.attributes.lastIntent; //recover user's original intent and process that
    		            session.attributes.lastIntent="";
		                switch(intent.name){
                        case 'CountIntent': //user asked How many... (change to default intro behavior)
            		        intent={
                                "name": "ReviewIntent",
                                "slots": {
                                    "fromFilter": {
                                        "name": "fromFilter"
                                    },
                                    "subjectFilter": {
                                    "name": "subjectFilter"
                                    },
                                    "readFilter": {
                                        "name": "readFilter",
                                        "value": "new"
                                    },
                                    "dateFilter": {
                                        "name": "dateFilter"
                                    }
                                }
	                         };
                            getSummary(intent,session,response);
                            break;
                        case 'ReviewIntent':
                            getSummary(intent,session,response);    
                            break;
                        case 'AMAZON.NextIntent':
                            getSummary(intent, session, response);
                            break;
                        case 'AMAZON.PreviousIntent':
             	            getSummary(intent, session, response);
 	                        break;
                        case 'RefreshIntent': //not a valid intent, so go to default behavior
		                    intent={
                                "name": "ReviewIntent",
                                "slots": {
                                    "fromFilter": {
                                        "name": "fromFilter"
                                    },
                                    "subjectFilter": {
                                      "name": "subjectFilter"
                                    },
                                    "readFilter": {
                                        "name": "readFilter",
                                         "value": "new"
                                    },
                                    "dateFilter": {
                                        "name": "dateFilter"
                                    }
                                }
	                        };
                            getSummary(intent,session,response);
                            break;

                        case 'AMAZON.StartOverIntent': 
            		        intent={
                                "name": "ReviewIntent",
                                "slots": {
                                    "fromFilter": {
                                        "name": "fromFilter"
                                    },
                                    "subjectFilter": {
                                      "name": "subjectFilter"
                                    },
                                    "readFilter": {
                                        "name": "readFilter",
                                         "value": "new"
                                    },  
                                    "dateFilter": {
                                        "name": "dateFilter"
                                    }
                                }
	                        };
                            getSummary(intent,session,response);
                            break;
                        case 'GoToMessageIntent':
                            getSummary(intent,session,response);
                            break;
                        case 'DetailsIntent':
                            messageDetails(intent, session, response);
                            break;
                        case 'MarkReadIntent':
 	                        modifyMessage(intent, session, response);
             	            break;
                        case 'MarkUnReadIntent':
 	                        modifyMessage(intent, session, response);
             	            break;
                        case 'StarIntent':
             	            modifyMessage(intent, session, response);
 	                        break;
                        case 'UnStarIntent':
 	                        modifyMessage(intent, session, response);
             	            break;
                        case 'DeleteIntent':
                            deleteConfirm (intent, session, response);
                            break;
                        case 'ReplyIntent':
                            replyMessage(intent, session, response);
                            break;
                        case 'ReplyAllIntent':
                            replyMessage(intent, session, response);
                            break;

                        case 'ListAttachmentsIntent':
                            listAttachments(intent, session, response);
                            break;
                        case 'WaitIntent':
                            makeResponse(session,response,54);
                            break;
                        default: //should not be able to get here, but added to handle unexxpected errors
                            intent={
                                    "name": "ReviewIntent",
                                    "slots": {
                                        "fromFilter": {
                                            "name": "fromFilter"
                                        },
                                        "subjectFilter": {
                                          "name": "subjectFilter"
                                        },
                                        "readFilter": {
                                            "name": "readFilter",
                                             "value": "new"
                                        },
                                        "dateFilter": {
                                            "name": "dateFilter"
                                        }
                                    }
	                            };
                            getSummary(intent,session, response); 
                        }
	                }
	            } else {
	                session.attributes.helpContext=3;
			    	makeResponse(session,response,3);
	            }
	        } catch(e) {
	            session.attributes.helpContext=3;
			    makeResponse(session,response,3);
			}
	   }
    });
}

//craft the response for the Alexa speech and/or card
function makeResponse(session,response,context,param1,param2){
	var speechText="";
	session.attributes.question="";
	var speechOutput,repromptText,repromptOutput,cardTitle,cardText,tmpSpeech;
	var speakindex,msg,i, attachments,readFilter;
	if(!session.attributes.started){
		speechText="Welcome to the Lucy skill.  ";1
		session.attributes.started=true;
	}	
	switch(context){
		case 1:
			speechOutput="I am having trouble interpreting your search request. Please try again.";
			if(!session.attributes.messageList){
			repromptText="<speak><p>You can say things like check my email, help, or say quit to exit.</p>  What would you like to do?</speak>";
			} else {
			repromptText="<speak><p>You can try a different search, say next message to go back to what you were doing, say help, or say quit to exit.</p>  What would you like to do?</speak>";
			}
			repromptOutput={speech:repromptText,type:'SSML'};
			break;
		case 2:
			speechOutput="Please open the Alexa app to reconnect your google account, and then try this skill again. Goodbye.";
			response.tellWithLinkAccount(speechOutput);
			break;
		case 3:
			speechText="<speak><p>"+speechText+"</p><p>I'm having trouble reaching Google to process your request.</p>You can try again, say help, or say quit if you're finished. What would you like to do?</speak>";
			speechOutput={speech:speechText,type:'SSML'};
			repromptOutput="You can say things like check my email, help or say wait, for more time.  What would you like to do?";
			break;
		case 4:
			session.attributes.question=1;
			if(session.attributes.tmpmessageList.resultSizeEstimate==1){
				speechOutput=speechText+"I found one"+session.attributes.tmpreadFilter+" message"+session.attributes.tmpsearchString+". would you like to review it?";
				repromptOutput="You can say yes to start at the first message I just found, or say no to go back to the previous list.  Would you like to review the message I found?";
			} else {
				speechOutput=speechText+"I found "+session.attributes.tmpmessageList.resultSizeEstimate+" "+session.attributes.tmpreadFilter+" messages"+session.attributes.tmpsearchString+". would you like to review them?";
				repromptOutput="You can say yes to start at the first message I just found, or say no to go back to the previous list.  Would you like to review the messages I found?";
			}
			break;
		case 5:
			speechText="<speak><p>"+speechText+"</p><p>I didn't find any" + param1 + " messages"+param2+".</p><p> You can say things like review all my messages, or say help for more choices.</p>  What would you like to do?</speak>";
			speechOutput={speech:speechText,type:'SSML'};
			repromptOutput="You can try another search, or say things like review all my messages, help, or say wait, for more time.  What would you like to do?";
			break;
		case 6:
		    if(session.attributes.readFilter==' total'&&session.attributes.searchString){readFilter='';}
		    else{readFilter=session.attributes.readFilter;}
			if(session.attributes.messageList.resultSizeEstimate==1){
				speechText="<speak><p>"+speechText+"</p><p>You have one"+readFilter+" message"+session.attributes.searchString+".</p></speak>";
			} else {
				speechText="<speak><p>"+speechText+"</p><p>You have "+session.attributes.messageList.resultSizeEstimate+" "+readFilter+" messages"+session.attributes.searchString+".</p></speak>";
			}
			speechOutput={speech:speechText,type:'SSML'};
			repromptOutput="You can say say things like next message, help, or say wait, for more time.  What would you like to do?";
			break;
		case 7:
			speechText="<speak><p>"+speechText+"</p><p>I think you asked me to do something with a message, but first I need to get a list of your messages.</p><p> You can say things like check my email, review all my messages, or help.</p>  What would you like to do?</speak>";
			speechOutput={speech:speechText,type:'SSML'};
			repromptOutput="You can say things like check my email.";
			break;
		case 8:
		    if(session.attributes.readFilter==' total'&&session.attributes.searchString){readFilter='';}
		    else{readFilter=session.attributes.readFilter;}
		    if(session.attributes.messageList.resultSizeEstimate==1){
			speechText="<speak><p>"+speechText+"</p><p>You have one"+readFilter+" message"+session.attributes.searchString+"</p>";
			} else {
				speechText="<speak><p>"+speechText+"</p><p>You have "+session.attributes.messageList.resultSizeEstimate+" "+readFilter+" messages"+session.attributes.searchString+"</p>";
			}
			speakindex=session.attributes.messageIndex+1;
			msg=session.attributes.currentMessage;
		    speechText = speechText+"<p>  Message: " + speakindex + ". From "+msg.from+". Received: "+msg.date+". Subject: "+msg.subject+".</p>";
		    speechText=speechText+"<p> You can say things like read more, next, erase, or say help for more options.</p>  What would you like to do?</speak>";
		    speechOutput={speech:speechText,type:'SSML'};
		    repromptText="<speak><p>You can say help for more choices, say wait, for more time, or say quit to exit.</p>  What would you like to do?</speak>";
		    repromptOutput={speech:repromptText,type:'SSML'};
            break;
        case 9:
            speakindex=session.attributes.messageIndex+1;
		msg=session.attributes.currentMessage;
		    speechText = "<speak><p>Message: " + speakindex + ". From: "+msg.from+". Received: "+msg.date+". Subject: "+msg.subject+".</p></speak>";
		    repromptText="<speak><p>You can say help for more choices, say wait for more time, or say quit to exit.</p>  What would you like to do?</speak>";
		    speechOutput={speech:speechText,type:'SSML'};
		    repromptOutput={speech:repromptText,type:'SSML'};
            break;
	    case 10:
	        switch(param1){
            case 'reachedend':
                speechOutput="You have reached the last message on this list.";
		   	    break;
	   	    case 'reachedfirst':
        	    speechOutput="You have reached the first message on this list.";
			    break;
		    case 'outofbounds':
			    speechOutput="I think you were trying to go to a specific message, but I can't find the one you are looking for.  Please say go to message, and then a number between 1 and "+session.attributes.messageList.resultSizeEstimate+", or ask me to do something else.";
	        }
	        repromptOutput={speech:"<speak><p>You can say things like get all my messages, help or say quit to exit.</p> What would you like to do next?</speak>",type:'SSML'};
	        break;
	    case 11:
	        speechText="<speak><p>Here's your message: </p><p>"+param1+"</p><p> That's the end of the message.</p><p>  You can say things like next message, or help.</p>What would you like to do?</speak>";
            speechOutput={speech:speechText,type:'SSML'};
            repromptOutput="You can say things like next message, help or say wait, for more time. What would you like to do?";
            session.attributes.lastSpeech=param1+"  That's the end of the message.  You can say things like next message, or help. What would you like to do?";
            response.ask(speechOutput,repromptOutput);
            break;
        case 12:
            switch(param1){
                case "MarkReadIntent": 
                    speechOutput="OK.  I marked that message as read.";
                    break;
                case "MarkUnReadIntent":
                    speechOutput="OK.  I marked that message as unread.";
                    break;
                case "StarIntent":
                    speechOutput="OK.  I marked that message as starred.";
                    break;
                case "UnStarIntent":
                    speechOutput="OK.  I removed the star from that message.";
                break;        
                case "AMAZON.YesIntent":
                speechOutput="OK.  I moved that message to your trash folder.";
            }
            repromptOutput="You can say things like next message, help, or say wait, for more time. What would you like to do?";
            break;
        case 13:
            speechText="<speak><p>If you are trying to reply, say reply, to answer only the sender, or reply all, to answer everyone on this message, followed by a short, 1 sentence message.</p><p>You can say something like, reply all, I'll see you then.</p> What would you like to do next?</speak>";
            speechOutput={speech:speechText,type:'SSML'};
            repromptOutput="You can try again to reply, or say things like next message, help, or say wait, for more time. What would you like to do?";
            break;
        case 14:
	    session.attributes.question=2;
            if(session.attributes.lastIntent.name=='ReplyIntent'){
                speechOutput="I think you asked me to reply to "+session.attributes.currentMessage.from+", saying, "+param1+". Would you like me to send this?";
            } else {
                speechOutput="I think you asked me to reply to everyone copied on this message, saying, "+param1+". Would you like me to send this?";
            }
            repromptOutput="You can say yes to send this message, say no to cancel or correct it, or say help.  Should I send the meessage?";
            break;
        case 15:
            speechOutput="OK.  I sent your message.";
            repromptOutput="You can say things like next message, help, or say wait, for more time. What would you like to do?";
            break;



	case 26: //some attachments were returned.  Read if one, ask if more.
		attachments = session.attributes.attachments;
		if(attachments.length>1){
				speechOutput = "This message has "+attachments.length+" attachments.  Would you like me to list them?";
            			session.attributes.question=6;
            			session.attributes.helpContext=14;
				repromptOutput="You can say yes to hear the attachments, say help, or say wait, for more time. Should I list the attachments?";
				    }
		if(attachments.length==1){
			 speechOutput = "This message has one attachment.  It is "+attachments[0][0]+" named "+attachments[0][1]+".";
            		  speechOutput =speechOutput +"  You can say things like next message, or say help for more options. What would you like to do?";
			repromptOutput="You can say things like repeat that, help, or say wait, for more time. What woud you like to do?";
			}
		
		break;
	case 27: //user said yes to hear the attachment list
		    speechOutput="Here are the attachments.  To interrupt me, you can say Alexa, followed by a command.";
		    for (i=1;i<=session.attributes.attachments.length;++i){
            		speechOutput=speechOutput+"Attachment "+i+" is "+session.attributes.attachments[i-1][0]+" named "+session.attributes.attachments[i-1][1]+". ";
		    }
		    repromptOutput="You can say things like repeat that, help, or say wait, for more time. What would you like to do?";
		    break;
	case 28: //cancel handler
		    session.attributes.question=4;
		    if(session.attributes.messageList){session.attributes.helpContext=2;}
		    else {session.attributes.helpContext=1;}
		    speechOutput="Would you like to quit?";
		    repromptOutput="You can say yes to quit, say no to continue, say help, or say wait, for more time.  Would you like to quit?";
		    break;
	case 29: //repeatHandler    		
    		if(session.attributes.lastSpeech){speechOutput=session.attributes.lastSpeech;}
		    else {speechOutput="I'm sorry.  I don't have any speech available to repeat.";}
		    repromptOutput="You can say help, say quit to exit, or say wait, for more time. What would you like to do?";
		    break;
	case 30: //delete confirm
		    speechOutput="Did you ask me to erase this message?";
		    repromptOutput="You can say yes to erase this message, say no, or say help for more information.  Do you want to erase this message?";
            session.attributes.question=5;
        	break;
	case 31: //reserved;
		    break;
	case 32: //user said yes to "set a pin?"
		    speechOutput="To set an access pin, say set my pin, followed by a 4 digit number.  For example, you can say set my pin to 1 2 3 4.  What would you like to do?";
		    repromptOutput="If you don't want to decide on a PIN now, I will ask you again next time. You can say things like check my email, help, or say wait, for more time.  What would you like to do?";
		    break;
	case 33: //said no the question - list attachments?
	    session.attributes.helpContext=6;
		speechOutput="OK.";
		repromptOutput="You can say things like next message, help or say wait, for more time.  What would you like to do?";
		break;
	case 34: //no question asked.
	    if(session.attributes.messageList){session.attributes.helpContext=6;}
		else {session.attributes.helpContext=4;}
		speechOutput = "Sorry, I don't think I asked a yes or no question.";
		if(session.attributes.messageList){
			repromptOutput="You can say things like next message, read more, help or say quit if you're finished.  What would you like to do?";}
		else {repromptOutput="You can say things check my email, help or say quit if you're finished.  What would you like to do?";}
		break;
	case 35: //said no to prompted action (delete, reply, trash)
	    session.attributes.helpContext=6;
		speechOutput="OK. I cancelled that.";
		repromptOutput="You can say things like next message, help or say wait, for more time.  What would you like to do?";
		break;
	case 36: //reserved
		break;
	case 37: //user said show me attachment on a message with no attachments.
	    speechOutput="This message has no attachments.";
	    repromptOutput="You can say things like next message, help, or say wait, for more time.  What would you like to do?";
    	break;
	case 38: //User said show me but atatchments are not JPG or PNG images
	    if(session.attributes.attachments.length==1){
	        speechOutput="This message has one attachment, but it is not an image that I can send to the Alexa app.";
	    } else {
		speechOutput="This message has "+session.attributes.attachments.length+" attachments, but none of them are images that I can send to the Alexa app.";}
		repromptOutput="You can say things like next message, help, or say wait, for more time.  What would you like to do?";
		break;
	case 39: //user said show me an attachment that was not an image but some others are
	    speechOutput="This message has "+session.attributes.attachments.length+" attachments. ";
	    if(param1.length==1){speechOutput=speechOutput+" I can only show you Attachment "+param1[0];}
	    else {
	        speechOutput=speechOutput+" I can show you ";
	        for (i=0;i<param1.length-1;++i){
	            speechOutput=speechOutput+"attachment "+param1[i]+", ";
	        }
	        i=param1.length-1;
	        speechOutput=speechOutput+" or attachment "+param1[i];
	    }
	    repromptOutput="You can say things like show me attachment "+param1[0]+" , next message, help, or say wait, for more time.  What would you like to do?";
	    break;
    case 40: //OK sent image to app
            speechOutput="OK.  I sent that to the Alexa app.";
            repromptOutput="You can say things like next message, help, or say wait, for more time.  What would you like to do?";
			 cardTitle="Image Attached to your message from "+session.attributes.currentMessage.from;
			 cardText="File name: "+session.attributes.attachments[param1][1];
			 response.askWithImageCard (speechOutput, repromptOutput, cardTitle, cardText,param2);
		    break;
    case 41: //OK sent last speech to app
            speechOutput="OK.  I sent that to the Alexa app.";
            repromptOutput="You can say things like next message, help, or say wait, for more time.  What would you like to do?";
			cardTitle="Last Thing Said by the My Email Skill:";
			cardText="";
			tmpSpeech=session.attributes.lastSpeech;
			if(typeof tmpSpeech=='object'){
			    cardText=tmpSpeech.speech.replace(/<[^>]*>/g, "");
			} else {cardText=tmpSpeech;}
			response.askWithCard (speechOutput, repromptOutput, cardTitle, cardText);
			break;
	case 42: //user said "my PIN is..without a number or one not 4 digits
		speechOutput=speechText+"I think you were trying to speak an access PIN but I didn't understand the number.  Please say your four-digit number.  If you were not trying to say a PIN, try your request again.  What would you like to do?";
		repromptOutput="You can say your PIN, say help, say quit to exit, or say wait, for more time.  What is your four-digit PIN?";
		break;
	case 43: //user with a PIN set, opened skill without saying their PIN.
		speechOutput=speechText+"First, what's your four-digit access PIN?";
		repromptOutput="You can say your PIN, say help, say quit to exit, or say wait, for more time.  What is your four-digit PIN?";
		break;
	case 44: //user spoke incorrect PIN
		speechOutput = {speech:"<speak><p>"+speechText+"</p>Sorry. <say-as interpret-as=\"digits\">"+param1+"</say-as> is not the correct access PIN.  Please say your PIN again.</speak>",type: 'SSML'};
		repromptOutput="You can say your PIN, say help, say quit to exit, or say wait, for more time.  What is your four-digit PIN?";
		break;
	case 45: //user has no PIN, first use only prompts asking about setting one.
	    session.attributes.question=7;
		speechOutput=speechText+"If you would like to prevent others from reading your email using this Alexa device, you can set a 4 digit access pin.  You would need to remember this pin to access your email with Alexa.  Would you like to set a PIN now?";
		repromptOutput="If you say yes, I'll help you set a PIN.  If you say no, I won't ask again, but you can set a PIN any time by saying set my PIN.  Do you want to set a PIN now?";
		break;
	case 48: //user said a PIN when it was already accepted
		speechOutput="I think you were trying to speak your access PIN, but the PIN had already been accepted.";
		repromptOutput="You can say things like review my messages, help, or say wait, for more time.  What would you like to do?"; 
		break;
	case 50: //user tried to set PIN but slot was empty or not 4 digits
	    if(session.attributes.messageList){session.attributes.helpContext=6;}
	    else {session.attributes.helpContext=4;}
		speechOutput=speechText+"I think you were trying to reset your access PIN but I didn't understand the new number.";
		repromptOutput="You can say things like review my messages,say help, for more options, or say wait, for more time.  What would you like to do?"; 
		break;
	case 51: //confirm successful PIN set
	    if(session.attributes.messageList){session.attributes.helpContext=6;}
	    else {session.attributes.helpContext=4;}
		speechText="<speak><p>OK.</p><p>I reset your access PIN to <say-as interpret-as=\"digits\">"+param1+"</say-as></p><p> You will need this new number to access this skill in the future.</p></speak>";
		speechOutput={speech:speechText,type:'SSML'};
		repromptOutput="You can say things like review my messages, help, or say wait, for more time.  What would you like to do?"; 
		break;
	case 52: //OK PIN cleared.
	    if(session.attributes.messageList){session.attributes.helpContext=6;}
	    else {session.attributes.helpContext=4;}
	    speechOutput="OK. Anyone using this Alexa device can now access the email skill without a PIN.";
	    repromptOutput="You can say things like review my messages, help, or say wait, for more time.  What would you like to do?"; 
	    break;
	case 53: //wrong PIN lockout
	    speechText="<speak><p>I'm sorry. </p><p>This account has been temporarily locked after too many incorrect PIN attempts.</p>I sent PIN reset instructions to the Alexa app.</speak>";
	    speechOutput={speech:speechText,type:'SSML'};
	    cardTitle="My Email Skill is Locked";
	    cardText="To reset your PIN, use a browser to visit\r\n http://email-skill.blogspot.com/p/pin-reset.html";
	    response.tellWithCard (speechOutput, cardTitle, cardText);
	    break;
	case 54:
	    speechOutput="OK. I'll wait.";
        repromptOutput="You can say help, say quit to exit, or say wait again, for more time.  What would you like to do?";
	    }


session.attributes.lastSpeech=speechOutput;
response.ask(speechOutput,repromptOutput);
}
// Create the handler that responds to the Alexa Request.
exports.handler = function(event, context) {
    var myGmail = new MyGmail();
    myGmail.execute(event, context);
};
