// TODO: fix a bug that the first component is put before the Input component

function clone_array(array){
  return array.map(function(a){return a;});
}

$(function() {
  function refresh(){
    setTimeout(function(){
      var blocks = [];
      var shape = [];
      var global_shape = [1, 1, 1, 1];  // kx, ky, sx, sy at input image
      var model_memory_footprint = 0;
      var variable_memory_footprint = 0;

      $("#header").removeClass("inconsistent");

      $("#network").children().each(function(i, elem){
        var type = $(elem).find(".component-header").text();
        var params = $(elem).find("input").map(function(j, number){
          return parseInt(number.value);
        });
        $(elem).find(".out").remove();
        $(elem).removeClass("inconsistent");

        var valid = true;

        if(type == "Input"){
          var batch = params[0], ch = params[1], h = params[2], w = params[3];
          shape = [batch, ch, h, w];
          variable_memory_footprint += batch * ch * h * w;
        }
        else if(type == "Linear"){
          var batch = shape[0];
          var feature = shape.slice(1).reduce(function(x, y){return x * y;});
          var dim_in = params[0], dim_out = params[1];
          var b = 1;  // bias
          if( feature != dim_in){
            valid = false;
          }
          shape = [batch, dim_out];
          model_memory_footprint += (dim_in + b) * dim_out;
          variable_memory_footprint += batch * dim_out;
        }
        else if(type == "Convolution2D"){
          var batch = shape[0], ch = shape[1], h = shape[2], w = shape[3];
          var ch_in = params[0], ch_out = params[1], kx = params[2];
          var ky = params[3], sx = params[4], sy = params[5];
          var b = 1;  // bias
          if( (w - kx) % sx == 0 && (h - ky) % sy == 0){
            w_new = ((w - kx) / sx) + 1;
            h_new = ((h - ky) / sy) + 1;
          }else{
            valid = false;
          }
          shape = [batch, ch_out, h_new, w_new];
          var gkx = global_shape[0], gky = global_shape[1];
          var gsx = global_shape[2], gsy = global_shape[3];
          gkx += gsx * (kx - 1);
          gky += gsy * (ky - 1);
          gsx *= sx;
          gsy *= sy;
          global_shape = [gkx, gky, gsx, gsy];
          model_memory_footprint += (ch_in * kx * ky + b) * ch_out;
          variable_memory_footprint += batch * ch_out * h_new * w_new;
        }
        else if(type == "Pooling"){
          var batch = shape[0], ch = shape[1], h = shape[2], w = shape[3];
          var px = params[0], py = params[1], sx = params[2], sy = params[3];
          if( (w - px) % sx != 0 || (h - py) % sy != 0){
            valid = false;
          }else{
            w_new = ((w - px) / sx) + 1;
            h_new = ((h - py) / sy) + 1;
          }
          
          var gkx = global_shape[0], gky = global_shape[1];
          var gsx = global_shape[2], gsy = global_shape[3];
          gkx += gsx * (px - 1);
          gky += gsy * (py - 1);
          gsx *= sx;
          gsy *= sy;
          global_shape = [gkx, gky, gsx, gsy];
          
          shape = [batch, ch, h_new, w_new];
          variable_memory_footprint += batch * ch * h_new * w_new;
        }
        else if(type == "Element-wise"){
          var batch = shape[0], ch = shape[1], h = shape[2], w = shape[3];
          variable_memory_footprint += batch * ch * h * w;
        }

        elem.shape = clone_array(shape);
        elem.global_shape = clone_array(global_shape);
        $(elem).append("<div class=out><hr><p>global shape: " + global_shape +
                       "</p><p>out: " + shape + "</p></div>");
        if(!valid){
          $(elem).addClass("inconsistent");
          $("#header").addClass("inconsistent");
        }
      });

      memory_footprint = variable_memory_footprint + model_memory_footprint;
      memory_footprint *= 4 // bytes of float32
      $("#footprint").val(memory_footprint.toLocaleString());
    }, 1);
  }

  $( "#network" ).sortable({
    handle: ".component-header",
    cancel: ".component-close",
    placeholder: "component-placeholder ui-corner-all",
    tolerance: "pointer",
    //cursor: "move",
    stop: function(event, ui){
      refresh();
    }
  });

  $( "#catalog .component" ).draggable({
    handle: ".component-header",
    connectToSortable: "#network",
    helper: "clone",
    stop : function(event, ui) {
      // some preparation
      ui.helper.removeAttr("style")
      .removeClass("ui-draggable")
      .find( ".component-header" )
      .prepend( "<span class='ui-icon ui-icon-closethick component-close'></span>")
      .find(".component-close" ).click(function() {
        var icon = $( this );
        icon.parent().parent().remove();
        refresh();
      });
      ui.helper.find("input[type=number]").bind("keyup input", function(){
        refresh();
      });

      // set the input size by the output size of the upstream element
      if(ui.helper.hasClass("parametric")){
        var upstream_shape = ui.helper[0].previousSibling.shape;
        var type = ui.helper.find(".component-header").text();
        if(type == "Linear"){
          var size = upstream_shape.slice(1).reduce(function(x, y){return x * y;});
          ui.helper.find("input[name=dim-in]").val(size).change();
        }else if(type == "Convolution2D"){
          var size = upstream_shape[1];
          ui.helper.find("input[name=ch-in]").val(size);
          ui.helper.find("input[name=ch-out]").val(size).change();
        }
      }
    }
  });

  $( ".component" )
  .addClass( "ui-widget ui-widget-content ui-helper-clearfix ui-corner-all" )
  .find( ".component-header" )
  .addClass( "ui-widget-header ui-corner-all" );

  $("#network input[type=number]").bind("keyup input", function(){
    refresh();
  });

  refresh();
});
