var filters = {} || filters;
(function() {
	filters.ColorChannel = {
		RED: 0,
		GREEN: 1,
		BLUE: 2,
		ALPHA: 3
	};

	filters.Point = function(x, y) {
		this.x = x || 0;
		this.y = y || 0;
	};

	filters.DisplacementMap = function(source, map, target, point, scaleX, scaleY, channelX, channelY) {
		this.source = source;
		this.map = map;
		this.target = target;
		this.sourceCtx = this.source.getContext("2d");
		this.mapCtx = this.map.getContext("2d");
		this.targetCtx = this.target.getContext("2d");
		this.point = point || new filters.Point();
		this.scaleX = scaleX || 10;
		this.scaleY = scaleY || 10;
		this.channelX = channelX || filters.ColorChannel.RED;
		this.channelY = channelY || filters.ColorChannel.RED;
		if (this.channelX != 0 && this.channelX != 1 && this.channelX != 2 && this.channelX != 3) this.channelX = filters.ColorChannel.RED;
		if (this.channelY != 0 && this.channelY != 1 && this.channelY != 2 && this.channelY != 3) this.channelY = filters.ColorChannel.RED;
	};

	var p = filters.DisplacementMap.prototype;

	p.draw = function() {
		var sourceData = this.sourceCtx.getImageData(0, 0, this.source.width, this.source.height);
		var mapData = this.mapCtx.getImageData(0, 0, this.map.width, this.map.height);
		var targetDataX = this.sourceCtx.getImageData(0, 0, this.source.width,  this.source.height);
		var targetDataY = this.sourceCtx.getImageData(0, 0, this.source.width,  this.source.height);
		var pixelsLength = mapData.data.length / 4;
		var colorValue,
			alphaValue,
			ratio,
			ratioWithAlpha,
			pixelShift,
			sourcePosition,
			targetPosition,
			x,
			y;
		var i = 0;
		while(i < pixelsLength) {
			x = ((i % this.map.width) + this.point.x) | 0;
			y = (((i / this.map.width) | 0) + this.point.y) | 0;
			colorValue = mapData.data[i*4+this.channelX];
			alphaValue = mapData.data[i*4+filters.ColorChannel.ALPHA];
			ratio = (colorValue / 0xFF * 2) -1;
			ratioWithAlpha = ratio * (alphaValue / 0xFF);
			pixelShift = (ratioWithAlpha * this.scaleX | 0);
			sourcePosition = (this.source.width * y) + x;
			targetPosition = (this.target.width * y) + x + pixelShift;
			this.setPixels(targetDataX, targetPosition, sourceData, sourcePosition);
			i++;
		}
		i = 0;
		while(i < pixelsLength) {
			x = ((i % this.map.width) + this.point.x) | 0;
			y = (((i / this.map.width) | 0) + this.point.y) | 0;
			colorValue = mapData.data[i*4+this.channelY];
			alphaValue = mapData.data[i*4+filters.ColorChannel.ALPHA];
			ratio = (colorValue / 0xFF * 2) -1;
			ratioWithAlpha = ratio * (alphaValue / 0xFF);
			pixelShift = (ratioWithAlpha * this.scaleY | 0);
			sourcePosition = (this.source.width * y) + x;
			targetPosition = (this.target.width * (y + pixelShift)) + x;
			this.setPixels(targetDataY, targetPosition, targetDataX, sourcePosition);
			i++;
		}
		this.targetCtx.putImageData(targetDataY, 0, 0);
	};

	p.setPixels = function(target, pos, source, i) {
		target.data[i*4] = source.data[pos*4];
		target.data[i*4+1] = source.data[pos*4+1];
		target.data[i*4+2] = source.data[pos*4+2];
		target.data[i*4+3] = source.data[pos*4+3];
	};
})();

makkoto = { widget: {} };

makkoto.widget.designer = function(wrapper_id, size) {
    var wrapper = document.getElementById(wrapper_id);

    this.controls_canvas = document.createElement('canvas');
    this.controls_canvas.id = 'designer-ui-controls';
    this.controls_canvas.width = size;
    this.controls_canvas.height = size;
    this.controls_canvas.style.opacity = 0;
    wrapper.appendChild(this.controls_canvas);
    this.controls_context = this.controls_canvas.getContext('2d');
    this.controls_stage = new createjs.Stage(this.controls_canvas.id);

    this.render_canvas = document.createElement('canvas');
    this.render_canvas.id = 'designer-ui-render';
    this.render_canvas.width = size;
    this.render_canvas.height = size;
    this.render_canvas.style.pointerEvents = 'none';
    wrapper.appendChild(this.render_canvas);
    this.render_context = this.render_canvas.getContext('2d');
    this.render_stage = new createjs.Stage(this.render_canvas.id);

    this.displacement_map_canvas = document.createElement('canvas');
    this.displacement_map_canvas.id = 'designer-ui-displacement-map';
    this.displacement_map_canvas.width = size;
    this.displacement_map_canvas.height = size;
    this.displacement_map_canvas.style.display = 'none';
    wrapper.appendChild(this.displacement_map_canvas);
    this.displacement_map_context = this.displacement_map_canvas.getContext('2d');

    this.compositor_canvas = document.createElement('canvas');
    this.compositor_canvas.id = 'designer-ui-compositor';
    this.compositor_canvas.width = size;
    this.compositor_canvas.height = size;
    this.compositor_canvas.style.display = 'none';
    wrapper.appendChild(this.compositor_canvas);
    this.compositor_context = this.compositor_canvas.getContext('2d');
    this.compositor_stage = new createjs.Stage(this.compositor_canvas.id);

    this.loader = new createjs.LoadQueue();
    this.layers = [];
    this.active_layer_id = null;
};

makkoto.widget.designer.prototype = {
    preload: function() {
        this.loader.on('complete', this.__proto__.init, this, true);
        // TODO: move the manifest into a caller
        this.loader.loadManifest([
            { id: 'product-diffuse', src: 'shirt-textured.png' },
            { id: 'product-displacement', src: 'shirt.png' },
            { id: 'product-specular', src: 'shirt-specular.png' },
            { id: 'product-mask', src: 'shirt.png' }, // Not necessarily the same!
            { id: 'controls-resize', src: 'controls-resize.png' },
            // TODO don't hardcode these
            { id: 'template', src: 'template.png' },
        ]);
    },

    init: function() {
        this.drawProductDiffuseMap();
        this.addEventToShowRenderCanvasOnMouseOut();
        this.drawDisplacementMap();
        this.updateControls();
        this.updateRender();
    },

    drawProductDiffuseMap: function() {
        var productBitmap = new createjs.Bitmap(this.loader.getResult('product-diffuse'));
        productBitmap.name = 'product';
        productBitmap.x = 0;
        productBitmap.y = 0;
        this.controls_stage.addChild(productBitmap);
    },

    drawDisplacementMap: function() {
        var displacement_map_context = this.displacement_map_context;
        displacement_map_context.drawImage(this.loader.getResult('product-displacement'), 0, 0);
    },

    addEventToShowRenderCanvasOnMouseOut: function() {
        var self = this;
        this.controls_canvas.addEventListener('mouseover', function() {
            self.controls_canvas.style.opacity = 1;
            self.render_canvas.style.opacity = 0;
        });
        this.controls_canvas.addEventListener('mouseout', function() {
            self.controls_canvas.style.opacity = 0;
            self.render_canvas.style.opacity = 1;
        });
    },

    addPhotoLayer: function(photo_id, photo_src) {
        this.loadLayerResource('photo', photo_id, photo_src);
    },

    loadLayerResource: function(resource_type, resource_id, resource_src) {
        var resource_name = this.layers.length + '-' + resource_type + '-' + resource_id;
        this.loader.on('complete', this.__proto__.addLayer, this, true, {
            layer_id: this.layers.length,
            resource_type: resource_type,
            resource_id: resource_id,
            resource_name: resource_name
        });
        this.loader.loadFile({ id: resource_name, src: resource_src });
    },

    addLayer: function(event, event_data) {
        this.layers.push({
            layer_id: event_data.layer_id,
            resource_type: event_data.resource_type,
            resource_id: event_data.resource_id,
            resource_name: event_data.resource_name
        });
        this.addLayerGraphic(event_data);
        this.addLayerControls(event_data);
        this.controls_stage.update();
        this.updateRender();
    },

    addLayerGraphic: function(event_data) {
        var graphicBitmap = new createjs.Bitmap(
            this.loader.getResult(event_data.resource_name)
        );
        var graphicBitmapBounds = graphicBitmap.getBounds();
        graphicBitmap.name = event_data.resource_name;
        graphicBitmap.controlsName = event_data.resource_name + '-controls';
        graphicBitmap.alpha = 0.5;
        graphicBitmap.resourceWidth = graphicBitmapBounds.width;
        graphicBitmap.resourceHeight = graphicBitmapBounds.height;
        this.addEventsForImageInteraction(graphicBitmap);
        this.controls_stage.addChild(graphicBitmap);
    },

    addLayerControls: function(event_data) {
        var graphicBitmap = this.controls_stage.getChildByName(event_data.resource_name);
        var graphicBounds = graphicBitmap.getBounds();
        this.drawControls(event_data.resource_name);
    },

    addEventsForImageInteraction(graphicBitmap) {
        this.addEventToSetImageCenterOnMouseDown(graphicBitmap);
        this.addEventToDragImageOnPressMove(graphicBitmap);
        this.addEventToUpdateRenderOnPressUp(graphicBitmap);
    },

    addEventToSetImageCenterOnMouseDown: function(graphicBitmap) {
        var self = this;
        graphicBitmap.on('mousedown', function(event) {
            var controls = self.controls_stage.getChildByName(this.controlsName);
            var controlResizeBitmap = self.controls_stage.getChildByName(this.controlsName + '-resize');
            self.setCenterToMouseLocation(this, event);
            self.setCenterToMouseLocation(controls, event);
            self.setCenterToMouseLocation(controlResizeBitmap, event);
        });
    },

    setCenterToMouseLocation: function(child, event) {
        var localMouseLocation = child.globalToLocal(event.stageX, event.stageY);
        child.regX = localMouseLocation.x;
        child.regY = localMouseLocation.y;
        child.x = event.stageX;
        child.y = event.stageY;
    },

    addEventToDragImageOnPressMove: function(graphicBitmap) {
        var self = this;
        graphicBitmap.on('pressmove', function(event) {
            var controls = self.controls_stage.getChildByName(this.controlsName);
            var controlResizeBitmap = self.controls_stage.getChildByName(this.controlsName+'-resize');
            self.setXYToMouseLocation(this, event);
            self.setXYToMouseLocation(controls, event);
            self.setXYToMouseLocation(controlResizeBitmap, event);
            self.controls_stage.update();
        });
    },

    setXYToMouseLocation: function(child, event) {
        child.x = event.stageX;
        child.y = event.stageY;
    },

    addEventToUpdateRenderOnPressUp: function(graphicBitmap) {
        var self = this;
        graphicBitmap.on('pressup', function(event) {
            self.updateRender();
        });
    },

    updateRender: function() {
        this.compositor_stage.removeAllChildren();
        this.compositeLayers();
        this.compositeTemplateMask();
        this.compositeDisplacementMap();
        this.compositeProductMask();

        this.render_stage.removeAllChildren();
        this.renderDiffuse();
        this.renderComposite();
        this.renderSpecular();
        this.render_stage.update();
    },

    compositeLayers: function() {
        for (var i = 0; i < this.controls_stage.children.length; i++) {
            this.cloneLayerToCompositorStage(this.controls_stage.children[i]);
        }
    },

    cloneLayerToCompositorStage: function(child) {
        if (this.isChildAProduct(child) || this.isChildAControls(child)) {
            return;
        }
        var cloneBitmap = child.clone();
        cloneBitmap.alpha = 1;
        cloneBitmap.visible = true;
        this.compositor_stage.addChild(cloneBitmap);
        this.compositor_stage.update();
    },

    isChildAProduct: function(child) {
        return child.name == 'product';
    },

    isChildAControls: function(child) {
        return child.name.indexOf('-controls') != -1;
    },

    compositeTemplateMask: function() {
        var template_mask = new createjs.Bitmap(this.loader.getResult('template')); // TODO hardcoded!
        template_mask.scaleX = template_mask.scaleY = 0.5; // TODO hardcoded!
        template_mask.x = 125; // TODO hardcoded!
        template_mask.y = 80; // TODO hardcoded!
        template_mask.compositeOperation = 'destination-in';
        this.compositor_stage.addChild(template_mask);
        this.compositor_stage.update();
    },

    compositeDisplacementMap: function() {
        new filters.DisplacementMap(
            this.compositor_canvas,
            this.displacement_map_canvas,
            this.compositor_canvas
        ).draw();
    },

    compositeProductMask: function() {
        this.compositor_context.globalCompositeOperation = 'destination-in';
        this.compositor_context.drawImage(this.loader.getResult('product-mask'), 0, 0);
        this.compositor_context.globalCompositeOperation = 'source-over';
    },

    renderDiffuse: function() {
        var productBitmap = new createjs.Bitmap(this.loader.getResult('product-diffuse'));
        this.render_stage.addChild(productBitmap);
    },

    renderComposite: function() {
        // TODO: how we render the composite should depend on a product flag
        var compositeBitmap = new createjs.Bitmap(this.compositor_canvas);
        // compositeBitmap.alpha = 0.5;
        // compositeBitmap.compositeOperation = 'screen';
        compositeBitmap.alpha = 1;
        compositeBitmap.compositeOperation = 'multiply'; // multiply for lighter tshirts
        this.render_stage.addChild(compositeBitmap);
    },

    renderSpecular: function() {
        var specularBitmap = new createjs.Bitmap(this.loader.getResult('product-specular'));
        specularBitmap.alpha = 0.8;
        specularBitmap.compositeOperation = 'overlay';
        this.render_stage.addChild(specularBitmap);
    },

    drawControls: function(resource_name) {
        var controls = this.getControlShape(resource_name);
        var controlBitmaps = this.getControlBitmaps(controls);
        this.clearControlBitmaps(controls);
        this.controls_stage.addChild(controls);
        for (var i = 0; i < controlBitmaps.length; i++) {
            this.controls_stage.addChild(controlBitmaps[i]);
        }
    },

    getControlShape: function(resource_name) {
        var controls = new createjs.Shape();
        var resource = this.controls_stage.getChildByName(resource_name);
        this.setControlsCenterToTopLeftCornerOfResource(controls, resource);
        this.setControlsMetadata(controls, resource);
        this.drawControlGraphics(controls);
        this.addEventsForControlsInteraction(controls);
        return controls;
    },

    setControlsCenterToTopLeftCornerOfResource: function(controls, resource) {
        var topLeftCoordinate = resource.localToGlobal(0, 0);
        controls.regX = controls.regY = 0;
        controls.x = topLeftCoordinate.x - 2;
        controls.y = topLeftCoordinate.y - 2;
    },

    setControlsMetadata: function(controls, resource) {
        var resourceBounds = resource.getBounds();
        controls.name = resource.name + '-controls';
        controls.resourceName = resource.name;
        controls.controlsWidth = resourceBounds.width * resource.scaleX;
        controls.controlsHeight = resourceBounds.height * resource.scaleY;
    },

    drawControlGraphics: function(controls) {
        controls.graphics
            .setStrokeStyle(2, 'round', 'miter', 10, true)
            .setStrokeDash([10, 8])
            .beginStroke('#333')
            .drawRect(0, 0, controls.controlsWidth + 4, controls.controlsHeight + 4)
            .setStrokeStyle(0, 'round', 'miter', 10, true)
            .beginFill('#333')
            .beginStroke('rgba(0,0,0,0)')
            .drawCircle(controls.controlsWidth + 2, controls.controlsHeight + 2, 15)
            ;
    },

    clearControlBitmaps: function(controls) {
        this.controls_stage.removeChild(
            this.controls_stage.getChildByName(controls.name + '-resize')
        );
    },

    getControlBitmaps: function(controls) {
        var resizeBitmap = new createjs.Bitmap(this.loader.getResult('controls-resize'));
        resizeBitmap.name = controls.name + '-resize';
        resizeBitmap.regX = controls.regX;
        resizeBitmap.regY = controls.regY;
        resizeBitmap.x = controls.x + controls.controlsWidth - 5.5;
        resizeBitmap.y = controls.y + controls.controlsHeight - 5.5;
        return [resizeBitmap];
    },

    addEventsForControlsInteraction: function(controls) {
        var self = this;
        controls.on('mousedown', function(event) {
            // TODO this does nothing at the moment :)
            // TODO also it's probably wrong because it doesn't use the redrawn
            // TODO control width
            // var resource = self.controls_stage.getChildByName(this.resourceName);
            // var resourceBounds = resource.getBounds();
            // var topLeftCoordinate = resource.localToGlobal(0, 0);
            // var scaleCoordinates = {
            //     minX: topLeftCoordinate.x + resourceBounds.width + 2 - (15 / 2),
            //     minY: topLeftCoordinate.y + resourceBounds.height + 2 - (15 / 2),
            //     maxX: topLeftCoordinate.x + resourceBounds.width + 2 + (15 / 2),
            //     maxY: topLeftCoordinate.y + resourceBounds.height + 2 + (15 / 2),
            // };
            // if (event.stageX > scaleCoordinates.minX &&
            //     event.stageX < scaleCoordinates.maxX &&
            //     event.stageY > scaleCoordinates.minY &&
            //     event.stageY < scaleCoordinates.maxY) {
            //     console.log('you clicked scale!');
            // }
            // console.log('scale not registered');
        });

        this.addEVentToScaleImageOnControlsPressMove(controls);
        this.addEventToRedrawControlsOnPressUp(controls);
    },

    addEVentToScaleImageOnControlsPressMove: function(controls) {
        var self = this;
        controls.on('pressmove', function(event) {
            // TODO: make sure we are pressing the scale control!
            var resource = self.controls_stage.getChildByName(this.resourceName);
            var resourceBounds = resource.getBounds();
            var topLeftCoordinate = resource.localToGlobal(0, 0);
            var scaledWidth = event.stageX - topLeftCoordinate.x;
            var scaledHeight = event.stageY - topLeftCoordinate.y;

            // reset transformation center to top left coord
            resource.regX = resource.regY = 0;
            resource.x = topLeftCoordinate.x;
            resource.y = topLeftCoordinate.y;

            this.regX = this.regY = 0;
            this.x = topLeftCoordinate.x - 2;
            this.y = topLeftCoordinate.y - 2;

            // apply aspect ratio maintaining scale
            var newScaleX = scaledWidth / resource.resourceWidth;
            var newScaleY = scaledHeight / resource.resourceHeight;

            this.graphics.clear();
            if (scaledWidth < resource.resourceWidth &&
                newScaleX < newScaleY) {
                this.controlsWidth = resource.resourceWidth * newScaleY;
                this.controlsHeight = scaledHeight;
                resource.scaleX = resource.scaleY = newScaleY;
            } else {
                this.controlsWidth = scaledWidth;
                this.controlsHeight = resourceBounds.height * newScaleX;
                resource.scaleX = resource.scaleY = newScaleX;
            }
            self.drawControlGraphics(this);
            self.clearControlBitmaps(this);
            var controlBitmaps = self.getControlBitmaps(this);
            for (var i = 0; i < controlBitmaps.length; i++) {
                self.controls_stage.addChild(controlBitmaps[i]);
            }
            self.controls_stage.update();
        });
    },

    addEventToRedrawControlsOnPressUp: function(controls) {
        var self = this;
        controls.on('pressup', function() {
            var resource = self.controls_stage.getChildByName(this.resourceName);
            var resourceBounds = resource.getBounds();
            var global = resource.localToGlobal(0, 0);
            self.drawControls(this.resourceName);
            self.controls_stage.removeChild(this);
            self.controls_stage.update();
            self.updateRender();
        });
    },

    setActiveLayerId: function(id) {
        this.active_layer_id = id;
    },

    updateControls: function() {
        for (var i = 0; i < this.controls_stage.children.length; i++) {
            var child = this.controls_stage.children[i];
            if (this.isChildPartOfTheActiveLayer(child) ||
                this.isChildAProduct(child)) {
                child.visible = true;
            } else {
                child.visible = false;
            }
        }
        this.controls_stage.update();
    },

    isChildPartOfTheActiveLayer: function(child) {
        var active_layer = this.getLayerFromId(this.active_layer_id);
        if ( ! active_layer) {
            return false;
        }
        return child.name.indexOf(active_layer.resource_name);
    },

    getLayerFromId: function(layer_id) {
        var layer_index = this.getLayerIndexFromid(layer_id);
        if ( ! layer_index) {
            return null;
        } else {
            return this.layers[layer_index];
        }
    },

    getLayerIndexFromid: function(layer_id) {
        for (var i = 0; i < this.layers.length; i++) {
            if (this.layers[i].layer_id == layer_id) {
                return i;
            }
        }
        return null;
    },

    setLayerTemplate: function(layer_id, template_id, template_src) {
        var layer_index = this.getLayerIndexFromid(layer_id);
        if ( ! layer_index) {
            return;
        }
        this.loadLayerTemplate(layer_id, template_id, template_src);
    },

    loadLayerTemplate: function(layer_id, template_id, template_src) {
        var template_name = layer_id + '-template-' + template_id;
        this.loader.on('complete', this.__proto__.addLayerTemplate, this, true, {
            layer_index: layer_index,
            template_id: template_id,
            template_src: template_src,
            template_name: template_name
        });
        this.loader.loadFile({ id: resource_name, src: resource_src });
    },

    addLayerTemplate: function(event, event_data) {
        // TODO
        // set the template details in our records
        // do some rendering tasks, perhaps.
    }
}

var designer = new makkoto.widget.designer('designer-wrapper', 500);
designer.preload();

document.getElementById('add-image-layer').addEventListener('click', function() {
    designer.addPhotoLayer('myPhotoId', this.dataset.src);
});

document.getElementById('update-layers').addEventListener('click', function() {
    console.log(designer.layers);
});
