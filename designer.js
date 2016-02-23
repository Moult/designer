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
            // TODO don't hardcode these
            { id: 'template', src: 'template.png' },
        ]);
    },

    init: function() {
        this.addEventToShowRenderCanvasOnMouseOut();
        this.drawProductDiffuseMap();
        this.drawDisplacementMap();
        this.updateRender();
    },

    drawProductDiffuseMap: function() {
        var productBitmap = new createjs.Bitmap(this.loader.getResult('product-diffuse'));
        productBitmap.name = 'product';
        productBitmap.x = 0;
        productBitmap.y = 0;
        this.controls_stage.addChild(productBitmap);
        this.controls_stage.update();
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
        this.controls_stage.update();
        this.updateRender();

        // let's add controls
        var graphicBounds = graphicBitmap.getBounds();
        var controls = this.getControlShape(
            event_data.resource_name,
            graphicBounds.x,
            graphicBounds.y,
            graphicBounds.width,
            graphicBounds.height
        );
        this.addEventsForControlsInteraction(controls);
        this.controls_stage.addChild(controls);
        this.controls_stage.update();
    },

    addEventsForImageInteraction(graphicBitmap) {
        this.addEventToSetImageCenterOnMouseDown(graphicBitmap);
        this.addEventToDragImageOnPressMove(graphicBitmap);
        this.addEventToUpdateRenderOnPressUp(graphicBitmap);
    },

    addEventToSetImageCenterOnMouseDown: function(graphicBitmap) {
        var self = this;
        graphicBitmap.on('mousedown', function(event) {
            console.log('graphic mousedown');
            var local = this.globalToLocal(event.stageX, event.stageY),
                nx = this.regX - local.x,
                ny = this.regY - local.y;
            this.regX = local.x;
            this.regY = local.y;
            // this.x -= nx;
            // this.y -= ny;
            this.x = event.stageX;
            this.y = event.stageY;

            // TODO dup code!
            var controls = self.controls_stage.getChildByName(this.controlsName),
                local = controls.globalToLocal(event.stageX, event.stageY),
                nx = controls.regX - local.x,
                ny = controls.regY - local.y;
            controls.regX = local.x;
            controls.regY = local.y;
            // controls.x -= nx;
            // controls.y -= ny;
            controls.x = event.stageX;
            controls.y = event.stageY;
        });
    },

    addEventToDragImageOnPressMove: function(graphicBitmap) {
        var self = this;
        graphicBitmap.on('pressmove', function(event) {
            console.log('graphic pressmove');
            this.x = event.stageX;
            this.y = event.stageY;
            // TODO dup code!
            var controls = self.controls_stage.getChildByName(this.controlsName);
            controls.x = event.stageX;
            controls.y = event.stageY;
            self.controls_stage.update();
        });
    },

    addEventToUpdateRenderOnPressUp: function(graphicBitmap) {
        var self = this;
        graphicBitmap.on('pressup', function(event) {
            console.log('graphic pressup');
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
        this.compositor_stage.addChild(cloneBitmap);
        this.compositor_stage.update();
    },

    isChildAProduct: function(child) {
        return child.name == 'product';
    },

    isChildAControls: function(child) {
        return child.name.substring(child.name.length - "-controls".length) == '-controls';
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

    getControlShape: function(resource_name, x, y, width, height) {
        var controls = new createjs.Shape();
        controls.name = resource_name + '-controls';
        controls.resourceName = resource_name;
        controls.controlsWidth = width;
        controls.controlsHeight = height;
        controls.graphics
            .setStrokeStyle(2, 'round', 'miter', 10, true)
            .setStrokeDash([10, 8])
            .beginStroke('#333')
            .drawRect(x - 2, y - 2, width + 4, height + 4)
            .setStrokeStyle(0)
            .beginFill('#333')
            .beginStroke('rgba(0,0,0,0)')
            .drawCircle(x - 2 + width + 2, y - 2 + height + 2, 15)
            ;
        return controls;
    },

    addEventsForControlsInteraction: function(controls) {
        var self = this;
        controls.on('mousedown', function(event) {
            console.log('control mousedown');
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

        controls.on('pressmove', function(event) {
            console.log('control pressmove');
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
            // this.regX = this.regY = 0;
            // this.x = topLeftCoordinate.x;
            // this.y = topLeftCoordinate.y;

            // apply aspect ratio maintaining scale
            var newScaleX = scaledWidth / resource.resourceWidth;
            var newScaleY = scaledHeight / resource.resourceHeight;

            var sY = scaledHeight / this.controlsHeight;
            var sX = scaledWidth / this.controlsWidth;
            console.log(this.controlsWidth);
            console.log(this.controlsHeight);

            if (scaledWidth < resource.resourceWidth && newScaleX < newScaleY) {
                // this.scaleX = this.scaleY = sY;
                resource.scaleX = resource.scaleY = newScaleY;
            } else {
                // this.scaleX = this.scaleY = sX;
                resource.scaleX = resource.scaleY = newScaleX;
            }

            self.controls_stage.update();
        });

        controls.on('pressup', function() {
            console.log('control pressup');
            var resource = self.controls_stage.getChildByName(this.resourceName);
            var resourceBounds = resource.getBounds();
            var global = resource.localToGlobal(0, 0);
            var newControl = self.getControlShape(
                this.resourceName,
                global.x, global.y,
                resourceBounds.width * resource.scaleX,
                resourceBounds.height * resource.scaleY
            );
            self.addEventsForControlsInteraction(newControl);
            self.controls_stage.removeChild(this);
            self.controls_stage.addChild(newControl);
            self.controls_stage.update();

            self.updateRender();
        });
    },
}

var designer = new makkoto.widget.designer('designer-wrapper', 500);
designer.preload();

document.getElementById('add-image-layer').addEventListener('click', function() {
    designer.addPhotoLayer('myPhotoId', this.dataset.src);
});
