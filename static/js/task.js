/*
 * Requires:
 *     psiturk.js
 *     utils.js
 */

// Initalize psiturk object
var psiTurk = new PsiTurk(uniqueId, adServerLoc, mode);

var mycondition = condition;  // these two variables are passed by the psiturk server process
var mycounterbalance = counterbalance;  // they tell you which condition you have been assigned to
// they are not used in the stroop code but may be useful to you

// All pages to be loaded
var pages = [
	"instructions/instruct-1.html",
	"instructions/instruct-2.html",
	"instructions/instruct-3.html",
	"instructions/instruct-ready.html",
	"stage.html",
	"postquestionnaire.html"
];

psiTurk.preloadPages(pages);

var instructionPages = [ // add as a list as many pages as you like
	"instructions/instruct-1.html",
	"instructions/instruct-2.html",
	"instructions/instruct-3.html",
	"instructions/instruct-ready.html"
];


/********************
* HTML manipulation
*
* All HTML files in the templates directory are requested 
* from the server when the PsiTurk object is created above. We
* need code to get those pages from the PsiTurk object and 
* insert them into the document.
*
********************/

/********************
* STROOP TEST       *
********************/
var StroopExperiment = function() {

	var wordon, // time word is presented
		listening = false;

	var getRandomFont = function() {
		var fonts = [
			"Slabo 27px", "Dancing Script", "Yesteryear", "Gochi Hand", "Press Start 2P", "Monoton", "VT323",
			"Times New Roman", "Arial", "Courier"
		];
		var index = Math.floor(Math.random() * fonts.length);
		return fonts[index];
	}
	// Stimuli for a basic Stroop experiment
	
	// another option is to create a list of colors and words and then randomly 
	var stims = [
		{word: "SHIP", color: "red", relation: "unrelated"},
		{word: "MONKEY", color: "green", relation: "unrelated"},
		{word: "ZAMBONI", color: "blue", relation: "unrelated"},
		{word: "RED", color: "red", relation: "congruent"},
		{word: "GREEN", color: "green", relation: "congruent"},
		{word: "BLUE", color: "blue", relation: "congruent"},
		{word: "GREEN", color: "red", relation: "incongruent"},
		{word: "BLUE", color: "green", relation: "incongruent"},
		{word: "RED", color: "blue", relation: "incongruent"},
	];

	stims = _.shuffle(stims);

	var next = function() {
		if (stims.length===0) {
			finish();
		}
		else {
			stim = stims.shift();
			font = getRandomFont();
			show_word(stim.word, stim.color, font);
			wordon = new Date().getTime();
			listening = true;
			d3.select("#query").html('<p id="prompt">Type "R" for Red, "B" for blue, "G" for green.</p>');
		}
	};
	
	var KEYS = {
		R: 82,
		G: 71,
		B: 66,
	}
	var response_handler = function(e) {
		if (!listening) return;

		var keyCode = e.keyCode,
			response;

		switch (keyCode) {
			case KEYS.R: response = "red";   break;
			case KEYS.G: response = "green"; break;
			case KEYS.B: response = "blue";  break;
			default: 	 response = "";    break;
		}
		if (response.length>0) {
			listening = false;
			var hit = response == stim.color;
			var rt = new Date().getTime() - wordon;

			psiTurk.recordTrialData({'phase': "TEST",
									 'word':  stim.word,
									 'color': stim.color, // sublime is dumb because it thinks color is css.
									 'relation': stim.relation,
									 'response': response,
									 'hit': hit,
									 'font': font,
									 'rt': rt}
								   );
			remove_word();
			next();
		}
	};

	var finish = function() {
		$("body").unbind("keydown", response_handler); // Unbind keys
		currentview = new Questionnaire();
	};
	
	var show_word = function(text, color, font) {
		d3.select("#stim")
			.append("div")
			.attr("id","word")
			.style("color",color)
			.style("font-family", font)
			.style("text-align","center")
			.style("font-size","150px")
			.style("font-weight","400")
			.style("margin","20px")
			.text(text);
	};

	var remove_word = function() {
		d3.select("#word").remove();
	};

	
	// Load the stage.html snippet into the body of the page
	psiTurk.showPage('stage.html');

	// Register the response handler that is defined above to handle any
	// key down events.
	$("body").focus().keydown(response_handler); 

	// Start the test
	next();
};


/****************
* Questionnaire *
****************/

var Questionnaire = function() {

	var error_message = "<h1>Oops!</h1><p>Something went wrong submitting your HIT. This might happen if you lose your internet connection. Press the button to resubmit.</p><button id='resubmit'>Resubmit</button>";

	record_responses = function() {

		psiTurk.recordTrialData({'phase':'postquestionnaire', 'status':'submit'});

		$('textarea').each( function(i, val) {
			psiTurk.recordUnstructuredData(this.id, this.value);
		});
		$('select').each( function(i, val) {
			psiTurk.recordUnstructuredData(this.id, this.value);		
		});

	};

	prompt_resubmit = function() {
		replaceBody(error_message);
		$("#resubmit").click(resubmit);
	};

	resubmit = function() {
		replaceBody("<h1>Trying to resubmit...</h1>");
		reprompt = setTimeout(prompt_resubmit, 10000);
		
		psiTurk.saveData({
			success: function() {
				clearInterval(reprompt); 
				psiTurk.computeBonus('compute_bonus', function(){finish()}); 
			}, 
			error: prompt_resubmit
		});
	};

	// Load the questionnaire snippet 
	psiTurk.showPage('postquestionnaire.html');
	psiTurk.recordTrialData({'phase':'postquestionnaire', 'status':'begin'});
	
	$("#next").click(function () {
		record_responses();
		psiTurk.saveData({
			success: function(){
				psiTurk.computeBonus('compute_bonus', function() { 
					psiTurk.completeHIT(); // when finished saving compute bonus, the quit
				}); 
			}, 
			error: prompt_resubmit});
	});
	
	
};

// Task object to keep track of the current phase
var currentview;

/*******************
 * Run Task
 ******************/
$(window).load( function(){
	psiTurk.doInstructions(
		instructionPages, // a list of pages you want to display in sequence
		function() { currentview = new StroopExperiment(); } // what you want to do when you are done with instructions
	);
});
