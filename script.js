// This script is a proof-of-concept that shows how we can compute a
// set of modifications that would get a source to a target graph, how
// to present those modifications to the user, and then how to write
// mapping rules that map each modification to changes in the source spec.
//
// How to extend this script to support arbitrary modifications:
// 1. Create a rule that creates a readable name for a modification in
//    `getReadableName()`
// 2. Create a rule that maps the modification to a Vega-Lite spec
//    change in `applyModification`

var gs = require('./graphscape.js');
var util = require('./src/util');


// We need some way to display the set of available edits in a way that makes
// it easy for a user to choose which edit they want to apply.  This function
// maps between a potential modification and a name that can be displayed in
// a menu.  Should be replaced by icons later.
// TODO(andrewhead@): this list should eventually support all edits desribed
// in the GraphScape `src/editOp/def.js` file.
// Assumes modification has already been annotated with a category
// ("mark", "encoding", "transformation").
function getReadableName(modification) {
    if (modification.category === "mark") {
        var markStyle = (
            modification.detail.after.substr(0, 1).toUpperCase() +
            modification.detail.after.substr(1).toLowerCase()
        );
        return "Mark style: " + markStyle;
    }
    if (modification.category === "encoding") {
        if (modification.name === "ADD_Y") {
            return "y variable";
        }
        if (modification.name === "MODIFY_X") {
            if (modification.detail.what === "field") {
                return "x field name";
            }
        }
    }
}


// Compute the modifications needed to transform a source spec into
// a target spec.  Generates a list of modifications.
function diffSpecs(source, target) {

    // Make copies of the source and borrowee, as the `transition` function
    // make make destructive edits to the specs.
    var sourceCopy = util.duplicate(source);
    var targetCopy = util.duplicate(target);
    var trans = gs.transition(sourceCopy, targetCopy);

    var keys = Object.keys(trans);
    var i, j;
    var key;
    var modification;
    var modifications = [];

    // Flatten the dictionary of modifications into a list.
    for (i = 0; i < keys.length; i++) {
        key = keys[i];
        if (trans[key].length !== undefined) {
            for (j = 0; j < trans[key].length; j++) {
                modification = trans[key][j];
                modification.category = key;
                modification.readableName = getReadableName(modification);
                modifications.push(modification);
            }
        }
    }
    return modifications;
}


// Non-desctructive application of a modification to a Vega-Lite spec.
// Takes in a Vega-Lite spec, returns a new one with the modification applied.
// TODO(andrewhead@): write a specification for each type of modification
function applyModification(spec, modification) {

    // Duplicate the spec so that no all modifications are non-destructive.
    var newSpec = util.duplicate(spec);

    // There are three possible categories: "mark", "encoding", and "transformation"
    // If we're updating the mark style, just change the mark type.
    if (modification.category === "mark") {
        newSpec.mark = modification.detail.after.toLowerCase();
    // Specific rules for updating the data source
    } else if (modification.category === "encoding") {
        if (modification.name === "ADD_Y") {
            newSpec.encoding.y = {
                field: "b",
                // TODO(andrewhead@): what is the right default here?
                type: "quantitative"
            };
        } else if (modification.name === "MODIFY_X") {
            newSpec.encoding.x[modification.detail.what] = modification.detail.after;
        }
    }
    return newSpec;
}


// EXAMPLE STARTS HERE
// The Vega-Lite spec that a user is working on.
var SOURCE = {
  "data": {"url": "data/cars.json"},
  "mark": "point",
  "encoding": {
    "x": {"field": "Horsepower","type": "quantitative"},
  }
};

// The Vega-Lite spec we're borrowing from.
var BORROWEE = {
    "data": {
        "values": [
            {"a": "A","b": 28}, {"a": "B","b": 55}, {"a": "C","b": 43},
            {"a": "D","b": 91}, {"a": "E","b": 81}, {"a": "F","b": 53},
            {"a": "G","b": 19}, {"a": "H","b": 87}, {"a": "I","b": 52}
        ]
    },
    "mark": "bar",
    "encoding": {
        "x": {"field": "a", "type": "ordinal"},
        "y": {"field": "b", "type": "quantitative"}
    }
};

// Get the list of modifications that would map one Vega-Lite spec to another.
var modifications = diffSpecs(SOURCE, BORROWEE);
var i;
var transformedSpec = SOURCE;

// Sanity check to make sure that the modifications do what we expect
// them to do when we apply them to the spec.
console.log("Before:\n", transformedSpec, "\n");
for (i = 0; i < modifications.length; i++) {
    console.log("Modification: \"" + modifications[i].readableName + "\"\n",
        modifications[i], "\n");
    transformedSpec = applyModification(transformedSpec, modifications[i]);
    console.log("New spec:\n", transformedSpec, "\n");
}
