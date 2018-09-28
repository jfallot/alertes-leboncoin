Alertes leboncoin
====================

Suite à la mise en place d'un système de protection (datadome) par leboncoin, il n'est plus possible d'utiliser Alertes leboncoin depuis le 31 Août 2018.
Votre aide est bienvenue :)

Script d'alertes email leboncoin.fr via Google Docs
Fork du projet de St3ph-fr (https://plus.google.com/u/0/b/116856005769817085204/116856005769817085204/posts)

Pour créer rapidement votre feuille de recherche: https://goo.gl/1daGn2

Historique des modifications :
 * 24 Aout 2018 - Contournement de la protection https://datadome.co/ mise en place par leboncoin
 * 17 Juin 2018 - Meilleure gestion du cas où une recherche en format JSON ne retourne aucun résultat
 * 15 Juin 2018 - Améliorations cosmétiques dans l'email 
 * 14 Juin 2018 - Refonte du code de parsing pour utiliser la structure window.FLUX_STATE (en JSON) au lieu de l'HTML.
                - Ajout du texte de description de l'objet dans l'email en cas de parsing Json
                - Le mode Html est conservé pour les recherches ne retournant pas de JSon
 * 11 Juin 2018 - Adaptation aux changements importants implémentés fin mai/début juin. Les images ne peuvent cependant plus être récupérées.
 * 14 Sept 2017 - Correction: images n'apparaissant plus dans les emails
 * 01 Aout 2017 - Gère le cas où aucun prix n'est précisé dans l'annonce
 * 08 Nov  2016 - Adaptation aux changements du site LeBonCoin.fr implémentés le 7 novembre
 * 20 Mai  2016 - Modifs proposées par Franck : ajout de l'heure dans le log + ajout de l'image "https://www.leboncoin.fr/img/no-picture-adview.png" lorsque l'annonce n'a pas de photo + ajout de la fonction purgeLog, qui permet de supprimer des lignes dans le log au dela du seuil défini par l'utilisateur
 * 31 Mars 2016 - Correction regression dans le case de "Setup Recherche"
 * 30 Mars 2016 - Identifie si la photo est manquante dans l'annonce, itération plus propre dans les annonces
 * 21 Mars 2016 - Correction message d'erreur si email destinataire non défini
 * 07 Mars 2016 - Format d'email plus compact
 * 06 Mars 2016 - Adaptation au nouveau site du Bon Coin, ainsi que quelques nettoyages
