import { init, use as registerModules } from 'echarts/core';
import {
  BarChart, LineChart, PieChart, ScatterChart, RadarChart,
  HeatmapChart, SunburstChart, SankeyChart,
} from 'echarts/charts';
import {
  GridComponent, TooltipComponent, LegendComponent, TitleComponent,
  VisualMapComponent, RadarComponent, AriaComponent, ToolboxComponent,
} from 'echarts/components';
import { LabelLayout } from 'echarts/features';
import { CanvasRenderer } from 'echarts/renderers';

registerModules([
  BarChart, LineChart, PieChart, ScatterChart, RadarChart, HeatmapChart,
  SunburstChart, SankeyChart, GridComponent, TooltipComponent, LegendComponent,
  TitleComponent, VisualMapComponent, RadarComponent, AriaComponent, ToolboxComponent,
  LabelLayout, CanvasRenderer,
]);

export { init };
