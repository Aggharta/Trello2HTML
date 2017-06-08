// Okay I admit the code is ugly...
if (typeof console === "undefined" || typeof console.log === "undefined") { //Fix IE window.console bug
 console = {};
 console.log = function() {};
} 

$(document).ready(function(){
	var defaultOptions = {
        scope: {
            write: false
        },
        name: "Trello2HTML",
        success: initDoc
    };
	if(typeof Trello==="undefined") {
		$("#view").html("<h1>Connection to Trello API is broken, please <a href='javascript:window.reload();'>try to reload</a></h1>");
	}

	Trello.authorize(_.extend({}, defaultOptions, {// Authentication
        interactive: false
    }));

    if (!Trello.authorized()) {
        return Trello.authorize(defaultOptions);
    }
    
	$(window).bind("hashchange",router);
});

var initDoc=function () {
	if (!Trello.authorized()) return Trello.authorize(defaultOptions);
	Trello.get('/members/me',{boards:"open",organizations:"all"}, function(me) {
		window.myself=me;
		router();
	},function(xhr){
		if (xhr.status == 401) {
			Trello.deauthorize();
			Trello.authorize(defaultOptions);
		} else {
			$("#view").html("<h1>Connection to Trello API is broken, Please <a href='javascript:reload();'>Reload</a></h1>");
		}
	});
};

var router=function(){
	var hash=location.hash.replace("#","");
	if (hash!=="")
	{
		getBoard(hash);
	}else {
		if(window.myself){
			listBoards();
		}else{
			initDoc();
		}
	}
};

var listBoards=function(){
	if(!myself.orgBoards) { // Not initiated yet
		var categories=_.groupBy(myself.boards,function(board){ // Categories Boards
			var id=board.idOrganization?board.idOrganization:"";
			return id;
		});
		var orgList=_.groupBy(myself.organizations,function(org){ // Map orgId-orgName
			return org.id;
		});

		myself.orgBoards=_.map(categories,function(value,key){ // Create Array of Organizations containing Array of Boards
			var list={};
			list.boards=value;
			if(key===""||key===null){
				list.name="Personal";
			}else if(!orgList.hasOwnProperty(key)){
				list.name="External Organization";
			}else{
				list.name=orgList[key][0].displayName
			}
			return list;
		});
	}

	$("#view").empty();
    var intro = "<div class='list info-list'><h2>About Trello2HTML</h2><p>This is a web application designed to export Trello Boards to a page-view list for easy overview and printing.</p><p>Use it to get a glimpse of all the details in your card in one single view, or print out the complete current information of your entire board, for personal reference or as preperation for a team meeting.</p><p>No information of you is being stored by this application.This application does not track you in any way, and cannot modify your Trello data.</p><p>You can host this application yourself on any static server. To download, please visit the project page on GitHub. If you encounter any issues, feel free to inform me there as well.</p > <ul><a href='#4d5ea62fd76aa1136000000c'><li>Demo using the public Trello Development board</li></a><a href='https://github.com/reischlfranz/Trello2HTML' target='_blank'><li>Project page on GitHub</li></a></ul><p>This application is based on <a href='https://github.com/tianshuo/Trello'>Trello2HTML by Tianshuo</a>.</p></div > ";
	var template="<h1>{{fullName}} ({{username}})</h1><div id='boardlist'>"+intro+"{{#orgBoards}}<div class='list'><h2>{{name}}</h2><ul>{{#boards}}<a href='#{{id}}' ><li>{{name}}</li></a>{{/boards}}</ul></div>{{/orgBoards}}</div>";
	var str=Mustache.render(template,myself);
	$("#view").html(str);
	$("#boardlist").masonry({
		itemSelector:'.list'
	});

};

var getBoard=function(board){
  $("#view").empty();
  $("#view").html("<h1>Loading ...</h1>");
  Trello.get("/boards/"+board,{cards:"open",lists:"open",checklists:"all",members:"all"},function(board){
	$("#view").html("<h1>Loading ...OK!!</h1>");
	window.doc=board; //debug
	window.title=board.name;
	_.each(board.cards,function(card){ //iterate on cards
		_.each(card.idChecklists,function(listId){ //iterate on checklists
			var list=_.find(board.checklists,function(check){ //Find list
				return check.id==listId;
				});
			if(!list){
				console.log("ERROR:"+listId+" not found");
				return;
			}
			list.doneNumber=0;
			list.totalNumber=list.checkItems.length || 0;
			_.each(list.checkItems,function(item){ //Check complete
				if(item.state=="complete"){
					list.doneNumber++;
					item.complete=true;
				}else item.complete=false;
			});
			list.done=(list.doneNumber==list.totalNumber);
            var template ="<div><b>{{name}}</b> <span class='show right {{#done}}green{{/done}}'>{{doneNumber}}/{{totalNumber}}</span></div><ul>{{#checkItems}}<li class='checklistitem{{#complete}} completed{{/complete}}'>{{name}}</li>{{/checkItems}}</ul>";
			var str=Mustache.render(template,list);

			card.checklist=card.checklist||[]; //Make array
			card.checklist.push(str);
		});//iterate on checklists

		card.members=_.map(card.idMembers,function(id){ // iterate on members
			var member=_.find(board.members, function(m) {
				return m.id==id;
			});
			return member.username;
		});// iterate on members
	});//iterate on cards

	// Second Init Cards
	var listofcards=_.groupBy(board.cards, function(card){
		return card.idList;
	});
	_.each(board.lists,function(list){
		list.cards=listofcards[list.id];
		list.size=list.cards?list.cards.length:0;
		list.show=(list.size>0);
	});
	console.log(board);

	// Date function
	board.formatDate=function(){
		return function(text){
			var date;
			switch(text){
			case "":
				return "None";
			case "now":
				date=new Date();
				break;
			default:
				date=new Date(text);
			}
			return date.getFullYear()+"-"+(date.getMonth()+1)+"-"+date.getDate();
		};
	};
	board.formatComments=function(){
		var converter = new Showdown.converter();
		return converter.makeHtml;
	};		
	//
	// Start Rendering
    board.displayColumns = [
        { "name": "Name", "class": "col_name" },
        { "name": "Description", "class": "col_descr" },
        { "name": "Due Date", "class": "col_due" },
        { "name": "Checklists", "class": "col_checklists" },
        { "name": "Members", "class": "col_members" },
        { "name": "Labels", "class": "col_labels" },
        { "name": "Votes", "class": "col_votes" }
    ];
    var htmltemplate = "<h1><span id='download'></span><span id='trello-link'></span><span id='printme'></span>{{name}} <span class='right'>{{#formatDate}}now{{/formatDate}}</span></h1>" +
        "{{#lists}}<table class='list-table' id='listID_{{id}}'><caption><h2>{{name}}<span class='show right'>{{size}}</span></h2><form class='noprint'><input type='checkbox' id='print_{{id}}' onchange='togglePrint(\"listID_{{id}}\")' /><label>Do Not Print</label></form></caption>" +
        "{{#show}}<col width='20%' class='col_name' /><col width='30%' class='col_descr' /><col width='5%' class='col_due' /><col width='25%' class='col_checklists' /><col width='5%' class='col_members' /><col width='10%' class='col_labels' /><col width='5%' class='col_votes'/><thead><tr>{{#displayColumns}}<th scope='col' class={{class}}>{{name}}</th>{{/displayColumns}}</tr></thead>{{/show}}<tbody>" +
            "{{#cards}}<tr><td scope='row' class='col_name'><b>{{name}}</b></td><td class='col_descr'><div class='comments'>{{#formatComments}}{{desc}}{{/formatComments}}</div></td><td class='col_due'>{{#formatDate}}{{due}}{{/formatDate}}</td><td class='col_checklists'>{{#checklist}}<div>{{{.}}}</div>{{/checklist}}</td><td class='col_members'>{{#members}}<div>{{.}}</div>{{/members}}</td><td class='col_labels'>{{#labels}}<div class='show {{color}}'>{{name}}&nbsp;</div>{{/labels}}</td><td class='col_votes'>{{badges.votes}}</td></tr>{{/cards}}"
        + "</tbody></table>{{/lists}}";
	var csvtemplate="";//TODO

	var str=Mustache.render(htmltemplate,board);
	$("#view").html(str);

	// Download Button
	var download="<!DOCTYPE html><html><head><meta charset='utf-8' /><title>"+board.name+"</title><style>"+$("style").text()+"</style></head><body>"+str+"</body></html>";
//this may work for firefox using application/data
//location.href="data:text/html;charset=utf-8,"+encodeURIComponent(download);
	var button1=$("#download");
	button1.addClass("downloader");
	button1.text("Save HTML");
	button1.click(function(){
		console.log("saving..");
		var bb=new BlobBuilder();
		bb.append(download);
		var filesaver=saveAs(bb.getBlob("text/html;charset=utf-8"),board.name+"_"+board.formatDate()('now')+".html");
	});
		var button2=$("#trello-link");
	button2.addClass("downloader");
	button2.text("Trello");
	button2.click(function(){
		location=board.url;
	});
	var button3=$("#printme");
	button3.addClass("downloader");
	button3.text("Print");
	button3.click(function(){
		print();
	});

	//button.click(function(){location.href="data:text/html;charset=utf-8,"+encodeURIComponent(download);});
	});
};

var togglePrint = function(toggle_id){
	// Should be doable without id handover?
	document.getElementById(toggle_id).classList.toggle('noprint');
}