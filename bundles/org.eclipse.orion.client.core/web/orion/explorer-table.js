/*******************************************************************************
 * @license
 * Copyright (c) 2009, 2011 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 * 
 * Contributors: IBM Corporation - initial API and implementation
 ******************************************************************************/

/*global define window */
/*jslint regexp:false browser:true forin:true*/

define(['require', 'dojo', 'dijit', 'orion/util', 'orion/explorer', 'orion/navigationUtils', 'orion/breadcrumbs', 'orion/fileCommands', 'orion/extensionCommands', 'orion/contentTypes', 'dojo/number'],
		function(require, dojo, dijit, mUtil,  mExplorer, mNavUtils, mBreadcrumbs, mFileCommands, mExtensionCommands){

	/**
	 * Tree model used by the FileExplorer
	 * TODO: Consolidate with eclipse.TreeModel.
	 */
	function Model(serviceRegistry, root, fileClient, treeId) {
		this.registry = serviceRegistry;
		this.root = root;
		this.fileClient = fileClient;
		this.treeId = treeId;
	}
	Model.prototype = new mExplorer.ExplorerModel(); 
	
	Model.prototype.getRoot = function(onItem){
		onItem(this.root);
	};
	/*
	Model.prototype.getTopIterationNodes = function(){
		return this.indexedFileItems;
	};
	*/
		
	Model.prototype.getChildren = function(/* dojo.data.Item */ parentItem, /* function(items) */ onComplete){
		// the parent already has the children fetched
		if (parentItem.children) {
			onComplete(parentItem.children);
		} else if (parentItem.Directory!==undefined && parentItem.Directory===false) {
			onComplete([]);
		} else if (parentItem.Location) {
			this.fileClient.fetchChildren(parentItem.ChildrenLocation).then( 
				dojo.hitch(this, function(children) {
					mUtil.processNavigatorParent(parentItem, children);
					onComplete(children);
				})
			);
		} else {
			onComplete([]);
		}
	};
	Model.prototype.constructor = Model;

	/**
	 * Renders json items into columns in the tree
	 */
	function FileRenderer (options, explorer, commandService, contentTypeService) {
		this.explorer = explorer;
		this.commandService = commandService;
		this.contentTypeService = contentTypeService;
		this.openWithCommands = null;
		this.actionScopeId = "fileFolderCommands";
		this._init(options);
		this.target = "_self";
	}
	FileRenderer.prototype = new mExplorer.SelectionRenderer(); 
	
	// we are really only using the header for a spacer at this point.
	FileRenderer.prototype.getCellHeaderElement = function(col_no){
		switch(col_no){
		case 0:
		case 1:
		case 2:
			return dojo.create("th", {style: "height: 8px;"});
		}
	};
		
	FileRenderer.prototype.setTarget = function(target){
		this.target = target;
		
		dojo.query(".targetSelector").forEach(function(node, index, arr){
			node.target = target;
		});
	};
	
	FileRenderer.prototype.getCellElement = function(col_no, item, tableRow){
		function isImage(contentType) {
			switch (contentType && contentType.id) {
				case "image/jpeg":
				case "image/png":
				case "image/gif":
				case "image/ico":
				case "image/tiff":
				case "image/svg":
					return true;
			}
			return false;
		}
		
		function addImageToLink(contentType, link) {
			switch (contentType && contentType.id) {
				case "image/jpeg":
				case "image/png":
				case "image/gif":
				case "image/ico":
				case "image/tiff":
				case "image/svg":
					var thumbnail = dojo.create("img", {src: item.Location}, link, "last");
					dojo.addClass(thumbnail, "thumbnail");
					break;
				default:
					if (contentType && contentType.image) {
						var image = dojo.create("img", {src: contentType.image}, link, "last");
						// to minimize the height/width in case of a large one
						dojo.addClass(image, "thumbnail");
					} else {	
						var fileIcon = dojo.create("span", null, link, "last");
						dojo.addClass(fileIcon, "core-sprite-file_model modelDecorationSprite");
					}
			}
		}
		
		switch(col_no){

		case 0:
			var col = document.createElement('td');
			var span = dojo.create("span", {id: tableRow.id+"MainCol"}, col, "only");
			dojo.addClass(span, "mainNavColumn");
			var link;
			if (item.Directory) {
				// defined in ExplorerRenderer.  Sets up the expand/collapse behavior
				var expandImage = this.getExpandImage(tableRow, span);
				mNavUtils.addNavGrid(this.explorer.getNavDict(), item, expandImage);
				link = dojo.create("a", {className: "navlinkonpage", id: tableRow.id+"NameLink", href: "#" + item.ChildrenLocation}, span, "last");
				dojo.place(document.createTextNode(item.Name), link, "last");
			} else {
				var i;			
				// Images: always generate link to file. Non-images: use the "open with" href if one matches,
				// otherwise use default editor.
				if (!this.openWithCommands) {
					this.openWithCommands = mExtensionCommands.getOpenWithCommands(this.commandService);
					for (i=0; i < this.openWithCommands.length; i++) {
						if (this.openWithCommands[i].isEditor === "default") {
							this.defaultEditor = this.openWithCommands[i];
						}
					}
				}
				var href = item.Location, foundEditor = false;
				for (i=0; i < this.openWithCommands.length; i++) {
					var openWithCommand = this.openWithCommands[i];
					if (openWithCommand.visibleWhen(item)) {
						href = openWithCommand.hrefCallback({items: item});
						foundEditor = true;
						break; // use the first one
					}
				}
				var contentType = this.contentTypeService.getFileContentType(item);
				if (!foundEditor && this.defaultEditor && !isImage(contentType)) {
					href = this.defaultEditor.hrefCallback({items: item});
				}				

				link = dojo.create("a", {className: "navlink targetSelector", id: tableRow.id+"NameLink", href: href, target:this.target}, span, "last");
				addImageToLink(contentType, link);
				dojo.place(document.createTextNode(item.Name), link, "last");
			}
			mNavUtils.addNavGrid(this.explorer.getNavDict(), item, link);
			this.commandService.renderCommands(this.actionScopeId, span, item, this.explorer, "tool", null, true);
			return col;
		case 1:
			var dateColumn = document.createElement('td');
			if (item.LocalTimeStamp) {
				var fileDate = new Date(item.LocalTimeStamp);
				dateColumn.innerHTML = dojo.date.locale.format(fileDate);
			}
			return dateColumn;
		case 2:
			var sizeColumn = document.createElement('td');
			if (!item.Directory && typeof item.Length === "number") {
				var length = parseInt(item.Length, 10),
					kb = length / 1024;
				sizeColumn.innerHTML = dojo.number.format(Math.ceil(kb)) + " KB";
			}
			dojo.style(sizeColumn, "textAlign", "right");
			return sizeColumn;
		}
	};
	FileRenderer.prototype.constructor = FileRenderer;

	/**
	 * Creates a new file explorer.
	 * @name orion.explorer-table.FileExplorer
	 * @class A user interface component that displays a table-oriented file explorer
	 * @param {orion.serviceRegistry.ServiceRegistry} options.serviceRegistry
	 * @param {Object} options.treeRoot
	 * @param {orion.selection.Selection} options.selection
	 * @param {orion.searchClient.Searcher} options.searcher
	 * @param {orion.fileClient.FileClient} options.fileClient
	 * @param {orion.commands.CommandService} options.commandService
	 * @param {orion.core.ContentTypeService} options.contentTypeService
	 * @param {String} options.parentId
	 * @param {String} options.breadcrumbId
	 * @param {String} options.toolbarId
	 * @param {String} options.selectionToolsId
	 */
	function FileExplorer(options) {
		this.registry = options.serviceRegistry;
		this.treeRoot = options.treeRoot;
		this.selection = options.selection;
		this.searcher = options.searcher;
		this.fileClient = options.fileClient;
		this.commandService = options.commandService;
		this.contentTypeService = options.contentTypeService;
		this.parentId = options.parentId;
		this.breadcrumbId = options.breadcrumbId;
		this.toolbarId = options.toolbarId;
		this.selectionToolsId = options.selectionToolsId;
		this.model = null;
		this.myTree = null;
		this.checkbox = false;
		this.renderer = new FileRenderer({checkbox: false, decorateAlternatingLines: false, cachePrefix: "Navigator"}, this, this.commandService, this.contentTypeService);
		this.preferences = options.preferences;
		this.setTarget();
		this.storageKey = this.preferences.listenForChangedSettings( dojo.hitch( this, 'onStorage' ) );
	}
	
	FileExplorer.prototype = new mExplorer.Explorer();
	
	// we have changed an item on the server at the specified parent node
	FileExplorer.prototype.changedItem = function(parent, forceExpand) {
		var that = this;
		this.fileClient.fetchChildren(parent.ChildrenLocation).then(function(children) {
			mUtil.processNavigatorParent(parent, children);
			//If a key board navigator is hooked up, we need to sync up the model
			if(that.getNavHandler()){
				that._initSelModel();
			}
			dojo.hitch(that.myTree, that.myTree.refresh)(parent, children, forceExpand);
		});
	};
	
	FileExplorer.prototype.isExpanded = function(item) {
		var rowId = this.model.getId(item);
		return this.renderer.tableTree.isExpanded(rowId);
	};
		
	FileExplorer.prototype.getNameNode = function(item) {
		var rowId = this.model.getId(item);
		if (rowId) {
			// I know this from my renderer below.
			return dojo.byId(rowId+"NameLink");
		}
	};
		
	//This is an optional function for explorerNavHandler. It changes the href of the window.location to navigate to the parent page.
	//The explorerNavHandler hooked up by the explorer will check if this optional function exist and call it when left arrow key hits on a top level item that is aleady collapsed.
	FileExplorer.prototype.scopeUp = function(){
		if(this.treeRoot && this.treeRoot.Parents){
			if(this.treeRoot.Parents.length === 0){
				window.location.href = "#";
			} else if(this.treeRoot.Parents[0].ChildrenLocation){
				window.location.href = "#" + this.treeRoot.Parents[0].ChildrenLocation;
			}
		}
	};
	
	FileExplorer.prototype.setTarget = function(){
	
		var preferences = this.preferences;	
		var renderer = this.renderer;
	
		this.preferences.getPreferences('/settings', 2).then( function(prefs){	
		
			var data = prefs.get("General");
			
			if( data !== undefined ){
					
				var storage = JSON.parse( data );
				
				if(storage){
					var target = preferences.getSetting( storage, "Navigation", "Links" );
					
					if( target === "Open in new tab" ){
						target = "_blank";
					}else{
						target = "_self";
					}
					
					renderer.setTarget( target );
				}
			}
		});
	};
	
	FileExplorer.prototype.onStorage = function (e) {
		if( e.key === this.storageKey ){
			this.setTarget();
		}
	};
	
	/**
	 * Load the resource at the given path.
	 * @param path The path of the resource to load
	 * @param [force] If true, force reload even if the path is unchanged. Useful
	 * when the client knows the resource underlying the current path has changed.
	 * @param postLoad a function to call after loading the resource
	 */
	FileExplorer.prototype.loadResourceList = function(path, force, postLoad) {
		// console.log("loadResourceList old " + this._lastHash + " new " + path);
		path = mUtil.makeRelative(path);
		if (!force && path === this._lastHash) {
			return;
		}
					
		this._lastHash = path;
		var parent = dojo.byId(this.parentId);			

		// we are refetching everything so clean up the root
		this.treeRoot = {};

		if (force || (path !== this.treeRoot.Path)) {
			//the tree root object has changed so we need to load the new one
			
			// Progress indicator
			var progress = dojo.byId("progress"); 
			if(!progress){
				progress = dojo.create("div", {id: "progress"}, parent, "only");
			}
			dojo.empty(progress);
			
			var progressTimeout = setTimeout(function() {
				dojo.empty(progress);
				var b = dojo.create("b");
				dojo.place(document.createTextNode("Loading "), progress, "last");
				dojo.place(document.createTextNode(path), b, "last");
				dojo.place(b, progress, "last");
				dojo.place(document.createTextNode("..."), progress, "last");
			}, 500); // wait 500ms before displaying
				
			this.treeRoot.Path = path;
			var self = this;
			
			this.fileClient.loadWorkspace(path).then(
				//do we really need hitch - could just refer to self rather than this
				dojo.hitch(self, function(loadedWorkspace) {
					clearTimeout(progressTimeout);
					//copy fields of resulting object into the tree root
					for (var i in loadedWorkspace) {
						this.treeRoot[i] = loadedWorkspace[i];
					}
					mUtil.processNavigatorParent(this.treeRoot, loadedWorkspace.Children);	
					//If current location is not the root, set the search location in the searcher
					this.searcher.setLocationByMetaData(this.treeRoot);
					// erase any old page title
					var breadcrumb = dojo.byId(this.breadcrumbId);
					if (breadcrumb) {
						dojo.empty(breadcrumb);
						new mBreadcrumbs.BreadCrumbs({
							container: breadcrumb, 
							resource: this.treeRoot,
							firstSegmentName: this.fileClient.fileServiceName(this.treeRoot.Path)
						});
					}
					mFileCommands.updateNavTools(this.registry, this, this.toolbarId, this.selectionToolsId, this.treeRoot);
					if (typeof postLoad === "function") {
						try {
							postLoad();
						} catch(e){
							this.registry.getService("orion.page.message").setErrorMessage(e);	
						}
					}
					this.model = new Model(this.registry, this.treeRoot, this.fileClient);
					this.createTree(this.parentId, this.model, {setFocus: true, onCollapse: function(model){if(self.getNavHandler()){self.getNavHandler().onCollapse(model);}}});
					if (typeof this.onchange === "function") {
						this.onchange(this.treeRoot);
					}
				}),
				dojo.hitch(self, function(error) {
					clearTimeout(progressTimeout);
					// Show an error message when a problem happens during getting the workspace
					if (error.status !== null && error.status !== 401){
						try {
							error = JSON.parse(error.responseText);
						} catch(e) {
						}
						dojo.place(document.createTextNode("Sorry, an error occurred: " + error.Message), progress, "only");
					}
				})
			);
		}
	};
	/**
	 * Clients can connect to this function to receive notification when the root item changes.
	 * @param {Object} item
	 */
	FileExplorer.prototype.onchange = function(item) {
	};
	FileExplorer.prototype.constructor = FileExplorer;

	//return module exports
	return {
		FileExplorer: FileExplorer
	};
});
