/*
 * ChangeLog
 * 24 Aout 2018 - Contournement de la protection https://datadome.co/ mise en place par leboncoin
 * 17 Juin 2018 - Meilleure gestion du cas où une recherche en format JSON ne retourne aucun résultat
 * 15 Juin 2018 - Améliorations cosmétiques dans l'email 
 * 14 Juin 2018 - Refonte du code de parsing pour utiliser la structure window.FLUX_STATE (en JSON) au lieu de l'HTML.
                - Ajout du texte de description de l'objet dans l'email en cas de parsing Json
                - Le mode Html est conservé pour les recherches ne retournant pas de JSon
 * 11 Juin 2018 - Adaptation aux changements importants implémentés fin mai/début juin. Les images ne peuvent cependant plus être récupérées.
 * 14 Sept 2017 - Correction: images n'apparaissant plus dans les emails* 06 Mars 2016 - Adaptation au nouveau site du Bon Coin, ainsi que quelques nettoyages
 * 01 Aout 2017 - Gère le cas où aucun prix n'est précisé dans l'annonce
 * 08 Nov  2016 - Adaptation aux changements du site LeBonCoin.fr implémentés le 7 novembre
 * 20 Mai  2016 - Modifs proposées par Franck : ajout de l'heure dans le log (à partir de ligne 112) + ajout de l'image "https://www.leboncoin.fr/img/no-picture-adview.png" lorsque l'annonce n'a pas de photo (ligne 257) + ajout de la fonction purgeLog, qui permet de supprimer des lignes dans le log au dela du seuil défini par l'utilisateur
 * 31 Mars 2016 - Correction regression dans le case de "Setup Recherche"
 * 30 Mars 2016 - Identifie si la photo est manquante dans l'annonce, itération plus propre dans les annonces
 * 21 Mars 2016 - Correction message d'erreur si email destinataire non défini
 * 07 Mars 2016 - Format d'email plus compact
 */

var debug = false;

var menuLabel = "Lbc Alertes";
var menuMailSetupLabel = "Setup email";
var menuSearchSetupLabel = "Setup recherche";
var menuSearchLabel = "Lancer manuellement";
var menuLog = "Activer/Désactiver les logs";
var menuArchiveLog = "Archiver les logs";
var menuPurgeLog = "Purger le log";
var menuNumberOfRowsToKeepInLog = "Nombre de lignes à conserver dans le log lors d'une purge";

var scriptProperties = PropertiesService.getScriptProperties(); 

function lbc(sendMail) {
  if (sendMail != false) {
    sendMail = true;
  }

  var to = scriptProperties.getProperty('email');
  if (to == "" || to == null) {
    Browser.msgBox("L'email du destinataire n'est pas défini. Allez dans le menu \"" + menuLabel + "\" puis \"" + menuMailSetupLabel + "\".");
  } else {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Recherches");
    var slog = ss.getSheetByName("Log");
    var searchIdx = 0;
    var nbSearchWithRes = 0;
    var nbResTot = 0;
    var corps = "";
    var bodyHTML = "";
    var summary = "";
    var searchURL = "";
    var searchName = "";

    var jsonStartTag = "<script>window.FLUX_STATE = ";
    var jsonStartPos = -1;

    while ((searchURL = sheet.getRange(2 + searchIdx, 2).getValue()) != "") {

      searchName = sheet.getRange(2 + searchIdx, 1).getValue();
      Logger.log("#### Recherche pour " + searchName);
 
      var options = {
        'muteHttpExceptions': true,
        'followRedirects': true,
        'headers': {
          'Accept': 'text/html',
          'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
          'Accept-Encoding': 'identity'
        }
      };   
      
      var rep = UrlFetchApp.fetch(searchURL, options).getContentText("utf-8"); //Next page: add by example &page=2

      // Serahc forthe window.FLUX_STATE JSON structure
      jsonStartPos = rep.lastIndexOf(jsonStartTag);
      var results = null;

      if (jsonStartPos >= 0) {

        // New: Browse ADs from the JSon
        Logger.log("  -> JSON format");
        
        // Extract the JSon structure included in the source, between the tags "<script>window.FLUX_STATE = " and "</script>
        var jsonSrc = rep.substring(jsonStartPos + jsonStartTag.length, rep.indexOf("</script>", jsonStartPos + jsonStartTag.length));

        var adStream = JSON.parse(jsonSrc);
        var ads = adStream.adSearch.data.ads;

        results = processJSONAds(sheet, searchIdx, ads);
          
      } else {

        // Compatibility: Browse ADS from the HTML
        Logger.log("  -> HTML format");
        
        results = processHTMLAds(sheet, searchIdx, rep);
      }
      
      if (results.nbRes > 0) {
        
        summary += "<li><a href=\"#" + searchName + "\">" + searchName + " (" + results.nbRes + ")</a></li>"
        
        if (scriptProperties.getProperty('log') == "true" || scriptProperties.getProperty('log') == null || scriptProperties.getProperty('log') == "") {
          slog.insertRowBefore(2);
          slog.getRange("A2").setValue(searchName);
          slog.getRange("B2").setValue(results.nbRes);
          var currentDate = new Date();
          slog.getRange("C2").setValue(currentDate.getDate() + "/" + currentDate.getMonth() + "/" + currentDate.getYear() + " - " + currentDate.toLocaleTimeString().replace(" CEST", ""));
          //slog.getRange("C2").setValue(new Date);
        }
        
        nbResTot += results.nbRes;
        nbSearchWithRes++

        bodyHTML += "<p style=\"display:block;clear:both;padding-top:2px;font-size:14px;font-weight:bold;background:#F1F1F5;\">Recherche <a name=\"" + searchName;
        bodyHTML += "\" href=\"" + searchURL + "\"> " + searchName + " (" + results.nbRes + ")</a></p>";
        bodyHTML += "<table border=\"0\" style=\"width:100%; vertical-align:middle; background:#FFFFFF;\"><tbody>" + results.announceHTML + "</tbody></table>";      
      }

      searchIdx++;
    }

    /* Disabling generation of a TOC since most web email interface don't allow it
    if (nbSearchWithRes > 1) {
      //plusieurs recherches, on créé un summary
      summary = "<ul>" + summary + "</ul>";
      bodyHTML = summary + bodyHTML;
      debug_(summary);
    }
    */

    debug_("Nb de res tot:" + nbResTot);
    //on envoie le mail?
    if (nbSearchWithRes > 0) {
      var title = "Alerte leboncoin.fr : " + nbResTot + " nouveau" + (nbResTot > 1 ? "x" : "") + " résultat" + (nbResTot > 1 ? "s" : "");
      debug_("titre msg : " + title);
      corps = "Si cet email ne s’affiche pas correctement, veuillez sélectionner\nl’affichage HTML dans les paramètres de votre logiciel de messagerie.";
      //debug_("corps msg : " + corps);
      bodyHTML = "<body style=\"font-family: Roboto,RobotoDraft,Helvetica,Arial,sans-serif;\"><meta charset=\"utf-8\">" + bodyHTML + "</body>";
      debug_("bodyHTML msg : " + bodyHTML);

      if (bodyHTML.length > 200 * 1024) {
        // Email body size is limited to 200 KB. Too big body is then truncated to avoid script to fail
        bodyHTML = bodyHTML.substring(0, 200 * 1024 - 1);
      }

      MailApp.sendEmail(to, title, corps, {
        htmlBody: bodyHTML
      });
      debug_("Nb mail journalier restant : " + MailApp.getRemainingDailyQuota());
    }
  }
}

/************************************************* JSON ********************************************/
/**
 * Extract the JSon structure included in the source, between the tags "<script>window.FLUX_STATE = " and "</script>
 */
function processJSONAds(sheet, searchIdx, ads) {

  var dateFormatOptions = {  
    weekday: "long", month: "short", year: "numeric",  
    day: "numeric", hour: "2-digit", minute: "2-digit"  
  };
  
  var nbRes = 0;
  var announceHTML = "";
  
  if ((typeof ads != "undefined") && (ads.length > 0)) {
    
    var nbAds = ads.length;
    var savedID = parseInt(sheet.getRange(2 + searchIdx, 3).getValue());
    var firstID = ads[0].list_id;
    
    if (firstID != savedID) {
      
      var adsIdx = 0;
      var announceId = firstID;
      
      //While ID of announce is different from the saved one
      do {
        var announceURL = ads[adsIdx].url;
        var title = ads[adsIdx].subject;
        
        var description = ads[adsIdx].body;
        if (description.length > 512)
          description = description.substring(0, 511);
        
        var place = ads[adsIdx].location.city_label;
        
        var price = "";
        if ((typeof ads[adsIdx].price != "undefined") && (ads[adsIdx].price.length > 0))
        price = ads[adsIdx].price[0] + " €";
        
        var dateOri = ads[adsIdx].first_publication_date;
        // Modify date format to match ISO 9601 one
        dateOri = dateOri.replace(" ", "T");
        var date = new Date(dateOri);
        var dateStr = date.toLocaleDateString("fr-FR", dateFormatOptions) + ", " + date.toLocaleTimeString("fr-FR", dateFormatOptions)
        
        var image = ads[adsIdx].images.thumb_url;
        if (image == null)
          image = "https://www.leboncoin.fr/img/no-picture-adview.png";
        
        var vendpro = "";
        
        announceHTML += "<tr style=\"height:1px; padding-bottom:10px;\"><td style=\"border-top:1px solid #ccc;\" colspan=\"2\"></td></tr>"
        announceHTML += "<tr><td style=\"width:200px;padding-right:0px;margin-top:0;\"><a href=\"" + announceURL + "\" target=\"" + announceId + "\"><img src=\"" + image + "\"></a></td>";
        announceHTML += "<td style=\"align:left;padding-left:2px;vertical-align:top;\"><a href=\"" + announceURL + "\" target=\"" + announceId + "\" style=\"font-size:16px;font-weight:bold;color:#369;text-decoration:none;\">";
        announceHTML += title + vendpro + "</a><div><span style=\"font-weight:bold;\">" + place + "</span> - " + dateStr + "</div><div style=\"font-size:16px;font-weight:bold;color:#FF5A19;\">" + price + "</div>";
        announceHTML += "<div style=\"font-size:10pt;color:#767676;\">" + description + "</div>";
        announceHTML += "</td></tr>";
        
        Logger.log("searchIdx=" + searchIdx + ", announceId=" + announceId);
        
        nbRes++;
        adsIdx++;
        
        if (adsIdx < nbAds)
          announceId = ads[adsIdx].list_id;
        
      } 
      while ((adsIdx < nbAds) && (announceId != savedID))
      
      // Save the ID of the latest Ad
      sheet.getRange(2 + searchIdx, 3).setValue(firstID);
    }
  }
  else {
    //pas de résultat
    sheet.getRange(2 + searchIdx, 3).setValue(123);
  }
  
  var results = new Object();
  results["nbRes"] = nbRes;
  results["announceHTML"] = announceHTML;
  
  return results;
}

/************************************************* HTML ********************************************/

/**
 * Extract the ADs from the HTML structure
 */
function processHTMLAds(sheet, searchIdx, html) {
  
  var nbRes = 0;
  var announceHTML = "";
  
  if (html.indexOf("Aucune annonce") < 0) {
    
    var data = extractListing_(html);
    
    var announceURL = extractA_(data);
    var firstID = extractId_(announceURL);
    var lastSavedID = sheet.getRange(2 + searchIdx, 3).getValue();
    
    if (firstID != lastSavedID) {
      
      var announceId = firstID;
      
      //While ID of announce is different from the saved one
      do {
        //Logger.log("data = " + data);
        
        var endListingMarker = "</li>";
        var endListingMarkerPos = data.indexOf(endListingMarker);
        
        if (endListingMarkerPos > 0) {
          
          nbRes++;
          
          var title = extractTitle_(data);
          var place = extractPlace_(data);
          var price = extractPrice_(data, endListingMarkerPos);
          var vendpro = extractPro_(data);
          var date  = extractDate_(data);
          var image = extractImage_(data, endListingMarkerPos);
          
          announceHTML += "<tr style=\"height:1px; padding-bottom:10px;\"><td style=\"border-top:1px solid #ccc;\" colspan=\"2\"></td></tr>"
          announceHTML += "<tr><td style=\"width:200px;padding-right:2px;\"><a href=\"" + announceURL + "\" target=\"" + announceId + "\"><img src=\"" + image + "\"></a></td>";
          announceHTML += "<td style=\"align:left;padding-left:0px;vertical-align:top;\"><a href=\"" + announceURL + "\" target=\"" + announceId + "\" style=\"font-size:16px;font-weight:bold;color:#369;text-decoration:none;\">";
          announceHTML += title + vendpro + "</a><div><span style=\"font-weight:bold;\">" + place + "</span> - " + date + "</div><div style=\"font-size:16px;font-weight:bold;color:#FF5A19;\">" + price + "</div>";
          announceHTML += "</td></tr>";
          
          Logger.log("searchIdx="+searchIdx+", announceId="+announceId);
          
          //Skip the block already analyzed by searching next announce
          var nextAnnounce = data.indexOf("<li itemscope", endListingMarkerPos + endListingMarker.length)
          if (nextAnnounce > 0) {
            data = data.substring(nextAnnounce);
            announceURL = extractA_(data);
            announceId  = extractId_(announceURL);
          }
          else
            announceId = "";
        } else
          announceId = "";
        
      } while ((announceId != "") && (announceId != lastSavedID))
      
    }

    sheet.getRange(2 + searchIdx, 3).setValue(firstID);

  } else {
    //pas de résultat
    sheet.getRange(2 + searchIdx, 3).setValue(123);
  }
  
  var results = new Object();
  results["nbRes"] = nbRes;
  results["announceHTML"] = announceHTML;
  
  return results;
}

/**
 * Extrait l'id de l'annonce LBC
 */
function extractId_(data) {

	var lastSlashPos = data.lastIndexOf("/");

	if (lastSlashPos < 0)
		return ""
	else
		return data.substring(lastSlashPos + 1, data.indexOf(".htm", lastSlashPos));
}

/**
 * Extrait le lien de l'annonce
 */
function extractA_(data) {

	var aPos = data.indexOf("href=");
	if (aPos < 0)
		return "";

	var found = data.substring(aPos + 6, data.indexOf(".htm", aPos + 6) + 4);

	// Handle case when the URL doesn't start by http:
	if (found.indexOf("//") == 0)
		return "https:" + found;
	else
	if (found.indexOf("/") == 0)
		return "https://www.leboncoin.fr" + found;
	else
		return found;
}

/**
 * Extrait le titre de l'annonce
 */
function extractTitle_(data) {

	startTitle = data.indexOf("title=") + 7;
	if (startTitle > 0)  
      return data.substring(startTitle , data.indexOf("\"", startTitle) );
    else
      return "No title found";
}

/**
 * Extrait vendeur pro
 */
function extractPro_(data) {

	var proMarker = "<span class=\"ispro\">";
	var proStart = data.indexOf(proMarker);
	var pro = data.substring(proStart + proMarker.length, data.indexOf("</span>", proStart + proMarker.length));

	if (pro.indexOf("(pro)") > 0) {
		return " (pro)";
	} else {
		return "";
	}
}

/**
 * Extrait le lieu de l'annonce
 */
function extractPlace_(data) {
  
  // Look for the 2nd "item_supp" block 
  //var infoMarker = "itemProp=\"availableAtOrFrom\" itemscope";
  var infoMarker = "<p class=\"item_supp\"";
  var info1pos = data.indexOf(infoMarker);
  info1pos = data.indexOf(infoMarker, info1pos + infoMarker.length);
  if (info1pos > 0) {
    var info2pos = data.indexOf(">", info1pos);
    return data.substring(info2pos+1, data.indexOf("</p>", info2pos+1) );
  }
  else
    return "";
}

/**
 * Extrait le prix de l'annonce
 */
function extractPrice_(data, endListingMarkerPos) {

	var priceMarker = "<h3 class=\"item_price\"";
	var priceStart = data.indexOf(priceMarker);

	if ((priceStart < 0) || (priceStart > endListingMarkerPos)) {
		return "";
	} else {     
		var price2Start = data.indexOf(">", priceStart + priceMarker.length);
		return data.substring(price2Start+1, data.indexOf("</h3>", price2Start+1) );
	}
}

/**
 * Extrait la date de l'annonce
 */
function extractDate_(data) {
  
  var infoMarker = "itemprop=\"availabilityStarts\"";
  var info1pos = data.indexOf(infoMarker);
  
  if (info1pos > 0) {
    info1pos = data.indexOf(">", info1pos+infoMarker.length);
    
    var info2pos = data.indexOf("</p>", info1pos+1);
    return data.substring(info1pos+1, info2pos);
  }
  else
    return "";
}

/**
 * Extrait l'image de l'annonce
 */
function extractImage_(data, endListingMarkerPos) {

  var imgStartMarker = "data-imgSrc=";
  var imageStart = data.indexOf(imgStartMarker);
  if ((imageStart < 0) || (imageStart > endListingMarkerPos)) {
    return "https://www.leboncoin.fr/img/no-picture-adview.png";
  }
  else {
    
    var imageEnd = data.indexOf("data-imgAlt=", imageStart);
    var image = data.substring(imageStart + imgStartMarker.length + 1, imageEnd - 2);
    return image;
  }    
}

/**
 * Extrait la liste des annonces
 */
function extractListing_(text) {

	/* var debut = text.indexOf("<section id=\"listingAds\""); */
	/* var debut = text.indexOf("<!-- Listing list -->"); */
	var debut = text.indexOf("<section class=\"tabsContent block-white dontSwitch");
	debut = text.indexOf("<li itemscope", debut);

	var fin = text.indexOf("</ul>", debut);

	if (fin > debut)
		return text.substring(debut, fin);
	else
		return "";
}

/************************************************* GENERAL ********************************************/
//Activer/Désactiver les logs
function dolog() {
  if (scriptProperties.getProperty('log') == "true") {
    scriptProperties.setProperty('log', false);
    Browser.msgBox("Les logs ont été désactivées.");
  } else if (scriptProperties.getProperty('log') == "false") {
    scriptProperties.setProperty('log', true);
    Browser.msgBox("Les logs ont été activées.");
  } else {
    scriptProperties.setProperty('log', false);
    Browser.msgBox("Les logs ont été désactivées.");
  }
}

function setup() {
  lbc(false);
}

function setupMail() {
  if (scriptProperties.getProperty('email') == "" || scriptProperties.getProperty('email') == null) {
    var quest = Browser.inputBox("Entrez votre email, le programme ne vérifie pas le contenu de cette boite.", Browser.Buttons.OK_CANCEL);
    if (quest == "cancel") {
      Browser.msgBox("Ajout email annulé.");
      return false;
    } else {
      scriptProperties.setProperty('email', quest);
      Browser.msgBox("Email " + scriptProperties.getProperty('email') + " ajouté");
    }
  } else {
    var quest = Browser.inputBox("Entrez un email pour modifier l'email : " + scriptProperties.getProperty('email'), Browser.Buttons.OK_CANCEL);
    if (quest == "cancel") {
      Browser.msgBox("Modification email annulé.");
      return false;
    } else {
      scriptProperties.setProperty('email', quest);
      Browser.msgBox("Email " + scriptProperties.getProperty('email') + " ajouté");
    }
  }
}

//Archiver les logs
function archivelog() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var slog = ss.getSheetByName("Log");
  var today = new Date();
  var newname = "LogArchive " + today.getFullYear() + (today.getMonth() + 1) + today.getDate();
  slog.setName(newname);
  var newsheet = ss.insertSheet("Log", 1);
  newsheet.getRange("A1").setValue("Recherche");
  newsheet.getRange("B1").setValue("Nb Résultats");
  newsheet.getRange("C1").setValue("Date");
  newsheet.getRange(1, 1, 2, 3).setBorder(true, true, true, true, true, true);
}

function setupNumberOfRowsToKeepInLog() {
  if (ScriptProperties.getProperty('NumberOfRowsToKeepInLog') == "" || ScriptProperties.getProperty('NumberOfRowsToKeepInLog') == null) {
    var quest = Browser.inputBox("Indiquez le nombre de lignes à conserver dans le log lors d'une purge : ", Browser.Buttons.OK_CANCEL);
    if (quest == "cancel") {
      Browser.msgBox("Paramétrage du nombre de lignes à conserver dans le log annulé, valeur inchangée (= " + ScriptProperties.getProperty('NumberOfRowsToKeepInLog') + ")");
      return false;
    } else if (isNaN(quest)) {
      Browser.msgBox("Vous devez entrer une valeur numérique entière");
      setupNumberOfRowsToKeepInLog()
    } else {
      if (quest == 0) {
        quest = 1;
      } else if (quest != "") {
        quest++;
      } else {
        quest = null;
      } //On préserve la première ligne contenant les entêtes de colone
      ScriptProperties.setProperty('NumberOfRowsToKeepInLog', quest);
      Browser.msgBox("Nombre de lignes à conserver dans le fichier de log lors d'une purge paramétré à : " + ScriptProperties.getProperty('NumberOfRowsToKeepInLog') + " (Notez que la première ligne contenant les entêtes de colone sera conservée)");
      return true;
    }
  } else {
    var quest = Browser.inputBox("Indiquez le nombre de lignes à conserver dans le log lors d'une purge : (valeur actuelle = ", +ScriptProperties.getProperty('NumberOfRowsToKeepInLog') + ")", Browser.Buttons.OK_CANCEL);
    if (quest == "cancel") {
      Browser.msgBox("Paramétrage du nombre de lignes à conserver dans le log annulé, valeur inchangée (= " + ScriptProperties.getProperty('NumberOfRowsToKeepInLog') + ")");
      return false;
    } else if (isNaN(quest)) {
      Browser.msgBox("Vous devez entrer une valeur numérique entière");
      setupNumberOfRowsToKeepInLog()
    } else {
      if (quest == 0) {
        quest = 1;
      } else if (quest != "") {
        quest++;
      } else {
        quest = null;
      } //On préserve la première ligne contenant les entêtes de colone
      ScriptProperties.setProperty('NumberOfRowsToKeepInLog', quest);
      Browser.msgBox("Nombre de lignes à conserver dans le fichier de log lors d'une purge paramétré à : " + ScriptProperties.getProperty('NumberOfRowsToKeepInLog') + " (Notez que la première ligne contenant les entêtes de colone sera conservée)");
      return true;
    }
  }
}

function purgeLog() {
  if (ScriptProperties.getProperty('NumberOfRowsToKeepInLog') == "" || ScriptProperties.getProperty('NumberOfRowsToKeepInLog') == null) {
    if (setupNumberOfRowsToKeepInLog() == false) {
      Browser.msgBox("Purge annulée, le nombre de lignes à conserver dans le log n'est pas paramétré");
    }
  }
  if (ScriptProperties.getProperty('NumberOfRowsToKeepInLog') != "" && ScriptProperties.getProperty('NumberOfRowsToKeepInLog') != null) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Log");
    var howmany = sheet.getLastRow() - ScriptProperties.getProperty('NumberOfRowsToKeepInLog')
    if (howmany > 0) {
      sheet.deleteRows(ScriptProperties.getProperty('NumberOfRowsToKeepInLog'), howmany);
    }
  }
}

function onOpen() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet();
  var entries = [{
      name: menuMailSetupLabel,
      functionName: "setupMail"
    }, {
      name: menuSearchSetupLabel,
      functionName: "setup"
    },
    null, {
      name: menuSearchLabel,
      functionName: "lbc"
    },
    null, {
      name: menuLog,
      functionName: "dolog"
    }, {
      name: menuArchiveLog,
      functionName: "archivelog"
    }, {
      name: menuPurgeLog,
      functionName: "purgeLog"
    }, {
      name: menuNumberOfRowsToKeepInLog,
      functionName: "setupNumberOfRowsToKeepInLog"
    }
  ];
  sheet.addMenu(menuLabel, entries);
}

function onInstall() {
  onOpen();
}

/**
 * Retourne la date
 */
function myDate_() {
  var today = new Date();
  debug_(today.getDate() + "/" + (today.getMonth() + 1) + "/" + today.getFullYear());
  return today.getDate() + "/" + (today.getMonth() + 1) + "/" + today.getFullYear();
}

/**
 * Retourne l'heure
 */
function myTime_() {
  var temps = new Date();
  var h = temps.getHours();
  var m = temps.getMinutes();
  if (h < "10") {
    h = "0" + h;
  }
  if (m < "10") {
    m = "0" + m;
  }
  debug_(h + ":" + m);
  return h + ":" + m;
}

/**
 * Debug
 */
function debug_(msg) {
  if (debug != null && debug) {
    Browser.msgBox(msg);
  }
}
