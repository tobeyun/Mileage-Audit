const INDEX_DATETIME = 0;
const INDEX_MILES = 1;
const INDEX_MINUTES = 2;
const INDEX_CALL_CHANNEL = 3;
const INDEX_RELATED_TO = 4;
const INDEX_SUBJECT = 5;
const INDEX_CUSTOMER = 6;
const INDEX_ADDR = 7;
const INDEX_CITY = 8;
const INDEX_ST = 9;
const INDEX_ZIP = 10;
const INDEX_LOCATION = 11;
const INDEX_CTC = 12;
const INDEX_DATE = 13;

const ROSTER_FILE = "Roster.txt";
const OUT_FILE =  "MileageResults.csv";

const ORIGIN_URL = "https://maps.googleapis.com/maps/api/distancematrix/json?units=imperial&mode=driving&origins=";
const DESTINATION_URL = "&destinations=";
const KEY_URL = "&key=";

var home = {};
var origin = "";
var destination = "";
var url = "";
var lines = [];

var reader;
var progress = document.querySelector(".percent");

var outputDiv = document.getElementById("output");
var errorDiv = document.getElementById("error");

document.getElementById("files").addEventListener("change", handleFileSelect, false);
document.getElementById("roster").addEventListener("change", handleRosterSelect, false);

function abortRead() {
	reader.abort();
}

function errorHandler(evt) {
	switch(evt.target.error.code) {
		case evt.target.error.NOT_FOUND_ERR:
			alert("File Not Found!");
			break;
		case evt.target.error.NOT_READABLE_ERR:
			alert("File is not readable");
			break;
		case evt.target.error.ABORT_ERR:
			break; // noop
		default:
			alert("An error occurred reading this file.");
	};
}

function updateProgress(evt) {
	// evt is an ProgressEvent.
	if (evt.lengthComputable) {
		var percentLoaded = Math.round((evt.loaded / evt.total) * 100);
		// Increase the progress bar length.
		if (percentLoaded < 100) {
			progress.style.width = percentLoaded + "%";
			progress.textContent = percentLoaded + "%";
		}
	}
}

function handleRosterSelect(evt) {
	console.log("handleRosterSelect");
	
	reader = new FileReader();
	reader.onerror = errorHandler;
	
	reader.onabort = function(e) {
	};
	
	reader.onloadstart = function(e) {
	};
	
	reader.onload = function(e) {
		var file = [];

		file = e.target.result.replace(/\r/g, "").split(/\n/);
		
		file.forEach(function(item) {
			var line = item.split(",");
			
			if (line.length == 2) {
				home[line[0]] = line[1];
				
				rosterDiv.innerHTML += line[0] + ": " + home[line[0]] + "<br />"; //e.target.result.replace(/\n/g, "<br />");
			}
		});
	}

	// Read in the image file as a string.
	reader.readAsText(evt.target.files[0]);
}

function handleFileSelect(evt) {
	console.log("handleFileSelect");
	
	outputDiv.innerHTML = "";
	
	reader = new FileReader();
	reader.onerror = errorHandler;
	reader.onprogress = updateProgress;
	
	reader.onabort = function(e) {
	};
	
	reader.onloadstart = function(e) {
	};
	
	reader.onload = function(e) {
		console.log("onload");
		text = reader.result;
		
		var file = [];

		file = reader.result.replace(/\r/g, "").split(/\n/);
		
		file.forEach(function(item) {
			lines.push(item.replace(/\s\s/g, " ").replace(/\",\"/g, ";").replace(/\"/g, "").replace(/,/g, ""));
		});
		
		if (lines.length > 0) { parseTravelLog(); }
	}

	// Read in the file as a string.
	reader.readAsText(evt.target.files[0]);
	
	inputFileNameToSaveAs.value = "MileageChecker_" + Date.now() + ".csv";
}

function initMap() {
	console.log("initMap");
	
	//var service = new google.maps.DistanceMatrixService;
}

function parseTravelLog() {
	var return_travel = 0;
	
	console.log("parseTravelLog");
	
	// print header
	document.getElementById("inputTextToSave").value = "CTC,Date/Time,Related To,Reported Miles,Google Miles,Mileage Delta,Reported Duration,Google Duration,Duration Delta,Return Travel,Origin,Destination,Case Address,Location" + "\n";

	// parse line list; start at 1 to skip header
	for (var i = 1; i < lines.length; i++) {
		// split current line on semi-colon into tokens
		var cline_tokens = lines[i].split(";");
		
		// get previous line as tokens
		var pline_tokens = lines[i-1].split(";");
		
		// skip empty line
		if (cline_tokens.length == 1) continue;
		
		// get time entry
		//var t = Time::Piece->strptime(cline_tokens[INDEX_DATETIME], '%m/%d/%Y %l:%M %p'); // '1/3/2020 8:30 AM'
		
		// was location field changed (ADDR not found in LOCATION)
		var location_changed = !cline_tokens[INDEX_LOCATION].includes(cline_tokens[INDEX_ADDR]);
		
		// is current line the same day as previous line
		var same_day = cline_tokens[INDEX_DATE] == pline_tokens[INDEX_DATE];
		
		// is current customer the same as previous line
		var same_addr = cline_tokens[INDEX_ADDR] == pline_tokens[INDEX_ADDR];
		
		// check to ensure CTC exists in list
		if (home[cline_tokens[INDEX_CTC]] === undefined) {
			alert("CTC not found. Please confirm correct roster and export files are being used.");
			
			return false;
		}
		
		// first record; home/hotel origin, customer destination; assume first record is accurate (i.e. begin travel)
		if (i == 1) {
			// if LOCATION was not changed by CTC, use home as origin, LOCATION as destination
			if (!location_changed) {
				origin = home[cline_tokens[INDEX_CTC]];
				
				destination = cline_tokens[INDEX_LOCATION];
			} else { // CTC has changed LOCATION to hotel address, use LOCATION (hotel) as origin, ADDR as destination
				origin = cline_tokens[INDEX_LOCATION];
				
				destination = cline_tokens[INDEX_ADDR] + "+" + cline_tokens[INDEX_CITY] + "+" + cline_tokens[INDEX_ST] + "+" + cline_tokens[INDEX_ZIP];
			}
			
			// reset return flag
			return_travel = 0;
		} else {
			// if current day [line_tokens] is the same as previous day [pline_tokens]
			if (same_day) {
				// if same customer address and return travel is not set (meaning, if it is the same day and the previous addr matches current, it is a return travel entry)
				if (same_addr) {
					// same day, same address as previous line means it is return travel (if return travel is not set); use current customer as origin, CTC home as destination; // TODO: CORRECT FOR OVERNIGHT STAYS
					if (!return_travel) {
						if (!location_changed) {
							origin = cline_tokens[INDEX_LOCATION];
							
							destination = home[cline_tokens[INDEX_CTC]];
						} else {
							origin = cline_tokens[INDEX_ADDR] + "+" + cline_tokens[INDEX_CITY] + "+" + cline_tokens[INDEX_ST] + "+" + cline_tokens[INDEX_ZIP];
							
							destination = cline_tokens[INDEX_LOCATION];
						}
					
						// set return flag
						return_travel = 1;
					}
					else { // else return travel was set on previous address indicating this is new travel (CTC went home and then back to same location)
						if (!location_changed) {
							origin = home[cline_tokens[INDEX_CTC]];
							
							destination = cline_tokens[INDEX_LOCATION];
						} else {
							origin = cline_tokens[INDEX_LOCATION];
							
							destination = cline_tokens[INDEX_ADDR] + "+" + cline_tokens[INDEX_CITY] + "+" + cline_tokens[INDEX_ST] + "+" + cline_tokens[INDEX_ZIP];
						}
						
						// reset return flag
						return_travel = 0;
					}
				} else { // else use previous customer as origin, current customer as destination
					// new travel from home/hotel, same day
					if (return_travel) {
						if (!location_changed) {
							origin = home[cline_tokens[INDEX_CTC]];
							
							destination = cline_tokens[INDEX_LOCATION];
						} else {
							origin = cline_tokens[INDEX_LOCATION];
							
							destination = cline_tokens[INDEX_ADDR] + "+" + cline_tokens[INDEX_CITY] + "+" + cline_tokens[INDEX_ST] + "+" + cline_tokens[INDEX_ZIP];
						}
						
						// reset return flag
						return_travel = 0;
					} else { // else new travel from previous customer (pline) to current customer (line)
						origin = pline_tokens[INDEX_ADDR] + "+" + pline_tokens[INDEX_CITY] + "+" + pline_tokens[INDEX_ST] + "+" + pline_tokens[INDEX_ZIP];
				
						destination = cline_tokens[INDEX_LOCATION];
					
						// reset return flag
						return_travel = 0;
					}
				}
			} else { // else new day; home/hotel is origin (regardless of employee), destination is current customer;
				if (!location_changed) {
					origin = home[cline_tokens[INDEX_CTC]];
					
					destination = cline_tokens[INDEX_LOCATION];
				} else {
					origin = cline_tokens[INDEX_LOCATION];
					
					destination = cline_tokens[INDEX_ADDR] + "+" + cline_tokens[INDEX_CITY] + "+" + cline_tokens[INDEX_ST] + "+" + cline_tokens[INDEX_ZIP];
				}
				
				// reset return flag
				return_travel = 0;
			}
		}
		
		// report missing address, miles, or minutes
		if (cline_tokens[INDEX_ADDR] == "" || 
			origin.includes("+++") || 
			cline_tokens[INDEX_MILES] == "" || 
			cline_tokens[INDEX_MINUTES] == "" || 
			cline_tokens[INDEX_MILES] == "0" || 
			cline_tokens[INDEX_MINUTES] == "0") { 
			
			var output = "";
			
			output = cline_tokens[INDEX_CTC] + "," + cline_tokens[INDEX_DATETIME] + "," + cline_tokens[INDEX_RELATED_TO] + ","; // CTC, Date/Time, Related To
			output += cline_tokens[INDEX_MILES] + ",-,-,"; // reported miles, Google miles, mileage delta
			output += cline_tokens[INDEX_MINUTES] + ",-,-,"; // reported duration, Google duration, duration delta
			output += origin + "," + destination + "," + return_travel + "," + "[[MISSING]]" + "<br />";
			
			errorDiv.innerHTML += output;
			
			continue;
		}
		
		var result = getMileage(origin, destination, return_travel, cline_tokens);
	}
	
	return true;
}

async function getMileage(origin, destination, return_travel, cline_tokens) {
	let url = "https://maps.googleapis.com/maps/api/distancematrix/json?units=imperial&mode=driving&origins=" + origin.replace(/[\s,]/g, "+") + "&destinations=" + destination.replace(/[\s,]/g, "+") + "&key=AIzaSyBPgKXltI08qG-WDqQ8F_99liSj25zRbR4";
		
	const response = await fetch(url);
	const data = await response.json();
	const element = data.rows[0].elements[0];
	
	var output = "";

	var google_miles = element.distance.value * 0.00062137;	// convert from meters to miles
	var google_minutes = element.duration.value / 60; 		// convert from seconds to minutes
	var miles_delta = cline_tokens[INDEX_MILES] - google_miles;
	var minutes_delta = cline_tokens[INDEX_MINUTES] - google_minutes;
	
	output = cline_tokens[INDEX_CTC] + "," + cline_tokens[INDEX_DATETIME] + "," + cline_tokens[INDEX_RELATED_TO] + ","; // CTC, Date/Time, Related To
	output += cline_tokens[INDEX_MILES] + "," + google_miles + "," + miles_delta + ","; // reported miles, Google miles, mileage delta
	output += cline_tokens[INDEX_MINUTES] + "," + google_minutes + "," + minutes_delta + ","; // reported duration, Google duration, duration delta
	output += return_travel + "," + origin + "," + destination + "," + cline_tokens[INDEX_ADDR] + "," + cline_tokens[INDEX_LOCATION] + "\n"; // origin address, destination address, return flag, reported address

	document.getElementById("inputTextToSave").value += output;
}

function destroyClickedElement(event)
{
    document.body.removeChild(event.target);
}

function saveTextAsFile()
{
    var textToSave = document.getElementById("inputTextToSave").value;
    var textToSaveAsBlob = new Blob([textToSave], {type:"text/plain"});
    var textToSaveAsURL = window.URL.createObjectURL(textToSaveAsBlob);
    var fileNameToSaveAs = document.getElementById("inputFileNameToSaveAs").value;
 
    var downloadLink = document.createElement("a");
    downloadLink.download = fileNameToSaveAs;
    downloadLink.innerHTML = "Download File";
    downloadLink.href = textToSaveAsURL;
    downloadLink.onclick = destroyClickedElement;
    downloadLink.style.display = "none";
    document.body.appendChild(downloadLink);
 
    downloadLink.click();
}
