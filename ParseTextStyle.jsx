const classProperty					= app.charIDToTypeID('Prpr');
const keyLayerID						= app.charIDToTypeID('LyrI');
const classLayer					= app.charIDToTypeID('Lyr ');
const kBackgroundSheet		= 12;
const unitNone		= app.charIDToTypeID('#Nne');
const unitAngle		= app.charIDToTypeID('#Ang');
const unitPercent	= app.charIDToTypeID('#Prc');
const unitPixels	= app.charIDToTypeID('#Pxl');

var colorPattern =/@color=[0-9a-fA-F]{6}/;
var fontsizePattern =/@fontsize=[0-9]+(.[0-9]+)?/;

var outlinePattern =/@outline=[0-9a-fA-F]{6}/;
var shadowPattern =/@shadow=[0-9a-fA-F]{6}/;
var gradientPattern =/@gradient=[0-9a-fA-F]{6},[0-9a-fA-F]{6}/;

var colorReg = new RegExp(colorPattern);
var fontsizeReg = new RegExp(fontsizePattern);

var outlineReg = new RegExp(outlinePattern);
var shadowReg = new RegExp(shadowPattern);
var gradientReg = new RegExp(gradientPattern);

var doc = app.activeDocument;

//////////////////////////////////// ActionDescriptor //////////////////////////////////////begin

ActionDescriptor.prototype.getFlatType = function( ID )
{
	return getFlatType( this, ID );
}

ActionDescriptor.prototype.getVal = function( keyList, firstListItemOnly  )
{
	if (typeof(keyList) == 'string')	// Make keyList an array if not already
		keyList = keyList.split('.');
		
	if (typeof( firstListItemOnly ) == "undefined")
		firstListItemOnly = true;

	// If there are no more keys to traverse, just return this object.
	if (keyList.length == 0)
		return this;
	
	keyStr = keyList.shift();
	keyID = makeID(keyStr);
	
	if (this.hasKey( keyID))
		switch (this.getType( keyID ))
		{
		case DescValueType.OBJECTTYPE:
			return this.getObjectValue( keyID ).getVal( keyList, firstListItemOnly );
		case DescValueType.LISTTYPE:
			var xx = this.getList( keyID );  // THIS IS CREEPY - original code below fails in random places on the same document.
			return /*this.getList( keyID )*/xx.getVal( keyList, firstListItemOnly );
		default: return this.getFlatType( keyID );
		}
	else
		return null;
}

ActionList.prototype.getVal = function( keyList, firstListItemOnly )
{
	if (typeof(keyList) == 'string')	// Make keyList an array if not already
		keyList = keyList.split('.');
		
	if (typeof( firstListItemOnly ) == "undefined")
		firstListItemOnly = true;

	// Instead of ID, pass list item #.  Duck typing.
	if (firstListItemOnly)
		switch (this.getType( 0 ))
		{
		case DescValueType.OBJECTTYPE:
			return this.getObjectValue( 0 ).getVal( keyList, firstListItemOnly );
		case DescValueType.LISTTYPE:
			return this.getList( 0 ).getVal( keyList, firstListItemOnly );
		default: return this.getFlatType( 0 );	
		}
	else
	{
		var i, result = [];
		for (i = 0; i < this.count; ++i)
			switch (this.getType(i))
			{
			case DescValueType.OBJECTTYPE:
				result.push( this.getObjectValue( i ).getVal( keyList, firstListItemOnly  ));
				break;
			case DescValueType.LISTTYPE:
				result.push( this.getList( i ).getVal( keyList, firstListItemOnly ));
				break;
			default:
				result.push( this.getFlatType( i ) );
			}
		return result;
	}
}

//////////////////////////////////// ActionDescriptor //////////////////////////////////////end

//////////////////////////////////// CSSToClipboard //////////////////////////////////////begin
function CSSToClipboard()
{
	// Constructor moved to reset(), so it can be called via a script.
}

cssToClip = new CSSToClipboard();

cssToClip.reset = function()
{
	this.pluginName = "CSSToClipboard";
	this.cssText = "";
	this.indentSpaces = "";
	this.browserTags = ["-moz-", "-webkit-", "-ms-"];
	this.currentLayer = null;
	this.currentPSLayerInfo = null;

	this.groupLevel = 0;
	this.currentLeft = 0;
	this.currentTop = 0;
	
	//this.groupProgress = new ProgressBar();
	
	this.aborted = false;
	
	// Work-around for screwy layer indexing.
	this.documentIndexOffset = 0;
	try {
		// This throws an error if there's no background
		if (app.activeDocument.backgroundLayer)
			//this.documentIndexOffset = 1;
	}
	catch (err)
	{}
}

cssToClip.reset();

cssToClip.setCurrentLayer = function( layer , index )
{
	this.currentLayer = layer;
	//this.currentPSLayerInfo = new PSLayerInfo(layer.itemIndex - this.documentIndexOffset, layer.isBackgroundLayer);
	//alert("传入index:" + index);
	if(index == null)
	{
		this.currentPSLayerInfo = new PSLayerInfo(layer.itemIndex - this.documentIndexOffset, true);
	}
	else
	{
		this.currentPSLayerInfo = new PSLayerInfo(index, true);
	}
}

cssToClip.getCurrentLayer = function()
{
	if (! this.currentLayer)
	{
		this.setCurrentLayer( app.activeDocument.activeLayer, null );
	}
	return this.currentLayer;
}

//cssToClip.getCurrentLayer();

cssToClip.getLayerAttr = function( keyString, layerDesc )
{ return this.currentPSLayerInfo.getLayerAttr( keyString, layerDesc ); }

//////////////////////////////////// CSSToClipboard //////////////////////////////////////end

//////////////////////////////////// PSLayerInfo //////////////////////////////////////begin
function PSLayerInfo( layerIndex, isBG )
{
	//alert("layerIndex" + layerIndex);
	this.index = layerIndex;
	this.boundsCache = null;
	this.descCache = {};
	
	if (isBG)
	{
		this.layerID = "BG";
		this.layerKind = kBackgroundSheet;
	}
	else
	{
		// See TLayerElement::Make() to learn how layers are located by PS events.
		var ref = new ActionReference();
		ref.putProperty( classProperty, keyLayerID );
		ref.putIndex( classLayer, layerIndex );
		var rrr = executeActionGet(ref);
		this.layerID = executeActionGet( ref ).getVal("layerID");
		this.layerKind = this.getLayerAttr("layerKind");
		//this.visible = this.getLayerAttr("visible");
	}
}

PSLayerInfo.prototype.getLayerAttr = function( keyString, layerDesc )
{
	var layerDesc;
	var keyList = keyString.split('.');
	
	if ((typeof(layerDesc) == "undefined") || (layerDesc == null))
	{
		// Cache the IDs, because some (e.g., Text) take a while to get.
		if (typeof this.descCache[keyList[0]] == "undefined")
		{
			var ref = new ActionReference();
			ref.putProperty( classProperty, makeID(keyList[0]));
			ref.putIndex( classLayer, this.index );
			layerDesc = executeActionGet( ref );
			this.descCache[keyList[0]] = layerDesc;
		}
		else
			layerDesc = this.descCache[keyList[0]];
	}

	return layerDesc.getVal( keyList );
}

PSLayerInfo.prototype.descToColorList = function( colorDesc, colorPath )
{
	function roundColor( x ) { x = Math.round(x); return (x > 255) ? 255 : x; }

	var i, rgb = ["'Rd  '", "'Grn '","'Bl  '"];	// Note double quotes around single quotes
	var rgbTxt = [];
	// See if the color is really there
	colorDesc = this.getLayerAttr( colorPath, colorDesc );
	if (! colorDesc)
		return null;

	for (i in rgb)
		rgbTxt.push( roundColor(colorDesc.getVal( rgb[i] )) );
	return rgbTxt;
}
//////////////////////////////////// PSLayerInfo //////////////////////////////////////end

//////////////////////////////////// Custom //////////////////////////////////////begin
function roundColor( x ) { x = Math.round(x); return (x > 255) ? 255 : x; }

function stripUnits( x ) { return Number( x.replace(/[^0-9.-]+/g, "") ); }

makeID = function( keyStr )
{
	if (keyStr[0] == "'")	// Keys with single quotes 'ABCD' are charIDs.
		return app.charIDToTypeID( eval(keyStr) );
	else
		return app.stringIDToTypeID( keyStr );
}

function getPSUnitValue( desc, ID )
{
	var srcUnitsID = desc.getUnitDoubleType( ID );
	
	if (srcUnitsID == unitNone)	// Um, unitless unitvalues are just...numbers.
		return round1k( desc.getUnitDoubleValue( ID ));
	
	// Angles and percentages are typically things like gradient parameters,
	// and should be left as-is.
	if ((srcUnitsID == unitAngle) || (srcUnitsID == unitPercent))
		return round1k(desc.getUnitDoubleValue( ID )) + unitIDToCSS[srcUnitsID];
		
	// Skip conversion if coming and going in pixels
	if (((srcUnitsID == unitPixels) || (srcUnitsID == enumRulerPixels))
		&& (app.preferences.rulerUnits == Units.PIXELS))
			return round1k(desc.getUnitDoubleValue( ID )) + "px";

	// Other units to pixels must first convert to points, 
	// then expanded by the actual doc resolution (measured in DPI)
	if (app.preferences.rulerUnits == Units.PIXELS)
		return round1k( desc.getUnitDoubleValue( ID ) * unitIDToPt[srcUnitsID] 
								* app.activeDocument.resolution / 72 ) + "px";
								
	var DOMunitStr = DOMunitToCSS[app.preferences.rulerUnits];

	// Pixels must be explictly converted to other units
	if ((srcUnitsID == unitPixels) || (srcUnitsID == enumRulerPixels))
		return pixelsToAppUnits( desc.getUnitDoubleValue( ID ) ).as(DOMunitStr) + DOMunitStr;
	
	// Otherwise, let Photoshop do generic conversion.
	return round1k( UnitValue( desc.getUnitDoubleValue( ID ), 
	                          unitIDToCSS[srcUnitsID] 
					      ).as( DOMunitStr ) ) + DOMunitStr;
}	

function round1k( x ) { return Math.round( x * 1000 ) / 1000; }

function getFlatType( desc, ID )
{
	switch (desc.getType( ID ))
	{
	case DescValueType.BOOLEANTYPE:	return desc.getBoolean( ID );
	case DescValueType.STRINGTYPE:		return desc.getString( ID );
	case DescValueType.INTEGERTYPE:	return desc.getInteger( ID );
	case DescValueType.DOUBLETYPE:	return desc.getDouble( ID );
	case DescValueType.UNITDOUBLE:	return getPSUnitValue( desc, ID );
	case DescValueType.ENUMERATEDTYPE: return typeIDToStringID( desc.getEnumerationValue(ID) );
	case DescValueType.REFERENCETYPE: return getReference( desc.getReference( ID ) );
	default: return desc.getType(ID).toString();
	}
}
//////////////////////////////////// Custom //////////////////////////////////////end



cssToClip.getDropShadow = function()
{
	var isEffectVisible = isTextLayerEffectVisible();
	if(!isEffectVisible)
	{
		return "";
	}
	var lfxDesc = cssToClip.getLayerAttr("layerEffects");
	var dsDesc = lfxDesc ? lfxDesc.getVal("dropShadow") : null;
	if(dsDesc == null)
	{
		return "";
	}
	var enable = dsDesc.getVal("enabled");
	if(!enable)
	{
		return "";
	}
	var rgbTxt = this.currentPSLayerInfo.descToColorList(dsDesc, "color");
	return changeToHex(rgbTxt);
}

cssToClip.getOutline = function()
{
	var isEffectVisible = isTextLayerEffectVisible();
	if(!isEffectVisible)
	{
		return "";
	}
	var lfxDesc = cssToClip.getLayerAttr("layerEffects");
	var dsDesc = lfxDesc ? lfxDesc.getVal("frameFX") : null;
	if(dsDesc == null)
	{
		return "";
	}
	var enable = dsDesc.getVal("enabled");
	if(!enable)
	{
		return "";
	}
	var rgbTxt = this.currentPSLayerInfo.descToColorList(dsDesc, "color");
	return changeToHex(rgbTxt);
}

cssToClip.getGradientFill = function()
{
	var isEffectVisible = isTextLayerEffectVisible();
	if(!isEffectVisible)
	{
		return "";
	}
	var lfxDesc = cssToClip.getLayerAttr("layerEffects");
	var dsDesc = lfxDesc ? lfxDesc.getVal("gradientFill") : null;
	if(dsDesc == null)
	{
		return "";
	}
	var enable = dsDesc.getVal("enabled");
	if(!enable)
	{
		return "";
	}
	
	var graDesc = dsDesc.getVal("gradient");
	
	var colorList = graDesc.getVal("colors", false);
	var result = "";
	for(s in colorList)
	{
		var rgbTxt = this.currentPSLayerInfo.descToColorList(colorList[s], "color");
		result += changeToHex(rgbTxt) + ",";
	}
	result = result.substr(0, result.length - 1);
	return result;
}

function changeToHex(rgbTxt)
{
	var value = "";
	for(var i = 0, len = rgbTxt.length; i < len; i++)
	{
		var string = rgbTxt[i].toString(16);
		if(string.length < 2)
		{
			string = "0" + string;
		}
		value += string;
	}
	return value;
	
}

function isTextLayerEffectVisible()
{
	var visible = cssToClip.getLayerAttr("layerFXVisible");
	return visible;
}

//////////////////////////////////// Through //////////////////////////////////////begin
function collectLayersByMixedAPI()
{
	var allLayers = new Array();
	doc.activeLayer = doc.layers[(doc.layers.length - 1)];
	var startLoop = Number(!hasBackground());
	var endLoop = getNumberOfLayer();
	
	for(var i = startLoop; i <= endLoop; i++)
	{
		while(!isValidActiveLayer())
		{
			i++
		}
		
		makeActiveByIndex(i, false);
		var layer = doc.activeLayer;
		if(layer.kind != LayerKind.TEXT)
		{
			continue;
		}
		var name = layer.name;
		
		var text = layer.textItem;
		var color = text.color.rgb["hexValue"];
		var size = text.size.value;
		
		if(colorReg.test(name))
		{
			name = name.replace(colorReg, "@color=" + color);
		}
		else
		{
			name += "@color=" + color;
		}
		
		if(fontsizeReg.test(name))
		{
			name = name.replace(fontsizeReg, "@fontsize=" + size);
		}
		else
		{
			name += "@fontsize=" + size;
		}
		
		cssToClip.setCurrentLayer(layer, i);
		allLayers.push(layer);
		
		var outline_rgb = cssToClip.getOutline();
		if(outline_rgb != "")
		{
			if(outlineReg.test(name))
			{
				name = name.replace(outlineReg, "@outline=" + outline_rgb);
			}
			else
			{
				name += "@outline=" + outline_rgb;
			}
		}
		else
		{
			if(outlineReg.test(name))
			{
				name = name.replace(outlineReg, "");
			}
		}
		
		var shadow_rgb = cssToClip.getDropShadow();
		if(shadow_rgb != "")
		{
			if(shadowReg.test(name))
			{
				name = name.replace(shadowReg, "@shadow=" + shadow_rgb);
			}
			else
			{
				name += "@shadow=" + shadow_rgb;
			}
		}
		else
		{
			if(shadowReg.test(name))
			{
				name = name.replace(shadowReg, "");
			}
		}
		
		var gradient_rgb = cssToClip.getGradientFill();
		if(gradient_rgb != "")
		{
			if(gradientReg.test(name))
			{
				name = name.replace(gradientReg, "@gradient=" + gradient_rgb);
			}
			else
			{
				name += "@gradient=" + gradient_rgb;
			}
		}
		else
		{
			if(gradientReg.test(name))
			{
				name = name.replace(gradientReg, "");
			}
		}
		
		layer.name = name;
	}
	return allLayers;
}

////////////////////
function isValidActiveLayer(idx)
{
	var propName = stringIDToTypeID('layerSection');
	var ref = new ActionReference();
	ref.putProperty(1349677170, propName);
	
	ref.putIndex(1283027488, idx);
	var desc = executeActionGet(ref);
	var type = desc.getEnumerationValue(propName);
	var res = typeIDToStringID(type);
	return res == 'layerSectionEnd' ? false : true;
}

function hasBackground()
{
	var res = undefined;
	try
	{
		var ref = new ActionReference();
		ref.putProperty(1349677170, 1315774496);
		ref.putIndex(1283027488, 0);
		executeActionGet(ref).getString(1315774496);
		res = true;
	}
	catch(e)
	{
		res = false;
	}
	return res;
}

function makeActiveByIndex(idx, forceVisible)
{
	try
	{
		var desc = new ActionDescriptor();
		var ref = new ActionReference();
		ref.putIndex(charIDToTypeID("Lyr"), idx);
		desc.putReference(charIDToTypeID("null"), ref);
		desc.putBoolean(charIDToTypeID("MKVs"), forceVisible);
		executeAction(charIDToTypeID("slct"), desc, DialogModes.NO);
	}
	catch(e)
	{
		return -1;
	}
}

function getNumberOfLayer()
{
	var ref = new ActionReference();
	ref.putEnumerated(charIDToTypeID("Dcmn"), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
	var desc = executeActionGet(ref);
	var numberOfLayer = desc.getInteger(charIDToTypeID("Nmbl"));
	
	return numberOfLayer;
}

function getLayerNameByIndex(idx)
{
	var ref = new ActionReference();
	ref.putProperty(charIDToTypeID("Prpr"), charIDToTypeID("Nm "));
	ref.putIndex(charIDToTypeID("Lyr "), idx);
	var ac = executeActionGet(ref);
	executeActionGet(ref).putString(charIDToTypeID("Nm "), "aaa");
	return executeActionGet(ref).getString(charIDToTypeID("Nm "));
}

///////////////main
var lyrs = collectLayersByMixedAPI();
alert("处理成功" + lyrs.length + "个:" + lyrs);

