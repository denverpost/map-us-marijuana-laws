// We specify the dimensions for the map container. We use the same
// width and height as specified in the CSS above.
var width = 900,
    height = 600;

// We define a variable to later hold the data of the CSV.
var mapData;

// We get and prepare the Mustache template, parsing it speeds up future uses
var template = d3.select('#template').html();
Mustache.parse(template);

// We create a SVG element in the map container and give it some
// dimensions. We can use a viewbox and preserve the aspect ratio. This
// also allows a responsive map which rescales and looks good even on
// different screen sizes
var svg = d3.select('#map').append('svg')
    .attr("preserveAspectRatio", "xMidYMid")
    .attr("viewBox", "0 0 " + width + " " + height);

// We add a <g> element to the SVG element and give it a class to
// style. We also add a class name for Colorbrewer.
var mapFeatures = svg.append('g')
    .attr('class', 'features YlGnBu');

// We add a <div> container for the tooltip, which is hidden by default.
var tooltip = d3.select("#map")
    .append("div")
    .attr("class", "tooltip hidden");

// Define the zoom and attach it to the map
var zoom = d3.behavior.zoom()
    .scaleExtent([1, 10])
    .on('zoom', doZoom);

svg.call(zoom);

// We define a geographical projection
//     https://github.com/mbostock/d3/wiki/Geo-Projections
// and set some dummy initial scale. The correct scale, center and
// translate parameters will be set once the features are loaded.
var projection = d3.geo.albersUsa()
    .translate([width / 2, height / 2]) // translate to center of screen
    .scale([1100]); // scale things down so see entire US

// We prepare a path object and apply the projection to it.
var path = d3.geo.path()
    .projection(projection);

// We prepare an object to later have easier access to the data.
var dataById = d3.map();

// Define linear scale for output
var color = d3.scale.linear()
    .range(["rgb(213,222,217)", "rgb(161,217,155)", "rgb(49,163,84)", "rgb(0,0,0)"]);

d3.json('data/states.json', function(error, features) {

    // Read the data for the cartogram
    //d3.csv('data/result.csv', function(data) {
    d3.json('data/20161109.js', function(data) {

        // We store the data object in the variable which is accessible from
        // outside of this function.
        mapData = data;

        // This maps the data of the CSV so it can be easily accessed by
        // the ID of the municipality, for example: dataById[2196]
        dataById = d3.nest()
            .key(function(d) {
                return d.state;
            })
            .rollup(function(d) {
                return d[0];
            })
            .map(data);

        color.domain([0, 1, 2, 3]); // setting the range of the input data

        // We add the features to the <g> element created before.
        // D3 wants us to select the (non-existing) path objects first ...
        mapFeatures.selectAll('path')
            // ... and then enter the data. For each feature, a <path>
            // element is added.
            .data(features.features)
            .enter()
            .append('path')
            // As "d" attribute, we set the path of the feature.
            .attr('d', path)
            // Make path stroke blue if it has a 2016 ballot issue
            // .style("stroke", function(d, i) {
            //     var ballotKey = dataById[d.properties.name].ballotkey;
            //     if (ballotKey != 'No') {
            //         d3.select(this.parentNode.appendChild(this))
            //         return ('#2c7fb8')
            //     } else {
            //         return '#F5F5F5';
            //     }
            // })

        .style("stroke", function(d, i) {
            var ballotKey = dataById[d.properties.name].ballotkey;
            var ballotPass = dataById[d.properties.name].ballotpass;
            if ((ballotKey == 'Yes') && (ballotPass == 'Yes')) {
                d3.select(this.parentNode.appendChild(this))
                return ('#ffff00')
            } else if ((ballotKey == 'Yes') && (ballotPass == 'No')) {
                d3.select(this.parentNode.appendChild(this))
                return ('#ff0000')
            } else
                d3.select(this.parentNode.appendChild(this))
            return ('#f5f5f5')
        })


        // ... and give it a wider stroke
        .style('stroke-width', function(d, i) {
                var ballotKey = dataById[d.properties.name].ballotkey;
                if (ballotKey != 'No') {
                    d3.select(this.parentNode.appendChild(this))
                    return '2.5';
                } else {
                    return '0.6';
                }
            })
            .style('cursor', 'default')
            // Fill state based on status value
            .style('fill', function(d) {
                // Get data value
                var value = dataById[d.properties.name].status;
                if (value) {
                    //If value exists…
                    return color(value);
                } else {
                    //If value is undefined…
                    return '#bdbdbd';
                }
            })
            // When the mouse moves over a feature, show the tooltip.
            .on('mousemove', showTooltip)
            // When the mouse moves out of a feature, hide the tooltip.
            .on('mouseout', hideTooltip)
            // When a feature is clicked, show the details of it.
            .on('click', showDetails)
            //updateMapColors();
    });
});

/**
 * Show the details of a feature in the details <div> container.
 * The content is rendered with a Mustache template.
 *
 * @param {object} f - A GeoJSON Feature object.
 */
function showDetails(f) {
    // Get the ID of the feature.
    var id = getIdOfFeature(f);
    // Use the ID to get the data entry.
    var d = dataById[id];

    // Render the Mustache template with the data object and put the
    // resulting HTML output in the details container.
    var detailsHtml = Mustache.render(template, d);

    // Hide the initial container.
    d3.select('#initial').classed("hidden", true);

    // Put the HTML output in the details container and show (unhide) it.
    d3.select('#details').html(detailsHtml);
    d3.select('#details').classed("hidden", false);
}

/**
 * Hide the details <div> container and show the initial content instead.
 */
function hideDetails() {
    // Hide the details
    d3.select('#details').classed("hidden", true);
    // Show the initial content
    d3.select('#initial').classed("hidden", false);
}

/**
 * Show a tooltip with the name of the feature.
 *
 * @param {object} f - A GeoJSON Feature object.
 */
function showTooltip(f) {
    // Get the ID of the feature.
    var id = getIdOfFeature(f);
    // Use the ID to get the data entry.
    var d = dataById[id];

    // Get the current mouse position (as integer)
    var mouse = d3.mouse(d3.select('#map').node()).map(
        function(d) {
            return parseInt(d);
        }
    );

    // Calculate the absolute left and top offsets of the tooltip. If the
    // mouse is close to the right border of the map, show the tooltip on
    // the left.
    var left = Math.min(width - 4 * d.state.length, mouse[0] - 50);
    var top = mouse[1] + 100;

    // Show the tooltip (unhide it) and set the name of the data entry.
    // Set the position as calculated before.
    tooltip.classed('hidden', false)
        .attr("style", "left:" + left + "px; top:" + top + "px")
        .html(d.state);
}

/**
 * Hide the tooltip.
 */
function hideTooltip() {
    tooltip.classed('hidden', true);
}

/**
 * Zoom the features on the map. This rescales the features on the map.
 * Keep the stroke width proportional when zooming in.
 */
function doZoom() {
    mapFeatures.attr("transform",
            "translate(" + d3.event.translate + ") scale(" + d3.event.scale + ")")
        // Keep the stroke width proportional. The initial stroke width
        // (0.5) must match the one set in the CSS.
        .style("stroke-width", 0.5 / d3.event.scale + "px");
}

/**
 * Calculate the scale factor and the center coordinates of a GeoJSON
 * FeatureCollection. For the calculation, the height and width of the
 * map container is needed.
 *
 * Thanks to: http://stackoverflow.com/a/17067379/841644
 *
 * @param {object} features - A GeoJSON FeatureCollection object
 *   containing a list of features.
 *
 * @return {object} An object containing the following attributes:
 *   - scale: The calculated scale factor.
 *   - center: A list of two coordinates marking the center.
 */
function calculateScaleCenter(features) {
    // Get the bounding box of the paths (in pixels!) and calculate a
    // scale factor based on the size of the bounding box and the map
    // size.
    var bbox_path = path.bounds(features),
        scale = 0.95 / Math.max(
            (bbox_path[1][0] - bbox_path[0][0]) / width,
            (bbox_path[1][1] - bbox_path[0][1]) / height
        );

    // Get the bounding box of the features (in map units!) and use it
    // to calculate the center of the features.
    var bbox_feature = d3.geo.bounds(features),
        center = [
            (bbox_feature[1][0] + bbox_feature[0][0]) / 2,
            (bbox_feature[1][1] + bbox_feature[0][1]) / 2
        ];

    return {
        'scale': scale,
        'center': center
    };
}

/**
 * Helper function to retrieve the ID of a feature. The ID is found in
 * the properties of the feature.
 *
 * @param {object} f - A GeoJSON Feature object.
 */
function getIdOfFeature(f) {
    return f.properties.name;
}
