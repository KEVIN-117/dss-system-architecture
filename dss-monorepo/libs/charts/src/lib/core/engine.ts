import { init, use as registerModules } from 'echarts/core';
import {
  BarChart, LineChart, PieChart, ScatterChart, RadarChart,
  HeatmapChart, SunburstChart, SankeyChart, TreemapChart, MapChart,
} from 'echarts/charts';
import {
  GridComponent, TooltipComponent, LegendComponent, TitleComponent,
  VisualMapComponent, RadarComponent, AriaComponent, ToolboxComponent, GeoComponent,
  DataZoomInsideComponent, DataZoomSliderComponent,
} from 'echarts/components';
import { LabelLayout } from 'echarts/features';
import { CanvasRenderer } from 'echarts/renderers';

registerModules([
  BarChart, LineChart, PieChart, ScatterChart, RadarChart, HeatmapChart,
  SunburstChart, SankeyChart, TreemapChart, MapChart, GridComponent, TooltipComponent, LegendComponent,
  TitleComponent, VisualMapComponent, RadarComponent, AriaComponent, ToolboxComponent, GeoComponent,
  DataZoomInsideComponent, DataZoomSliderComponent,
  LabelLayout, CanvasRenderer,
]);

export { init };
