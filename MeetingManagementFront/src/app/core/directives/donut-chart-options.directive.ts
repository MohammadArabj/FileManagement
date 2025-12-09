import { Directive, Input } from '@angular/core';
import { ApexChart, ApexDataLabels, ApexFill, ApexLegend, ApexNonAxisChartSeries, ApexPlotOptions, ApexResponsive, ApexTooltip } from 'ng-apexcharts';

@Directive({
  selector: '[appDonutChartOptions]',
  standalone: true,
  exportAs: 'donutChart'
})
export class DonutChartOptionsDirective {
  @Input() chartSeries: ApexNonAxisChartSeries = [];
  @Input() chartLabels: string[] = [];
  @Input() totalLabel: string = '';
  @Input() totalCount: number = 0;
  @Input() tooltipSuffix: string = '';
  @Input() chartColors: string[] = [];

  get chartOptions(): Partial<{
    series: ApexNonAxisChartSeries;
    chart: ApexChart;
    labels: string[];
    responsive: ApexResponsive[];
    legend: ApexLegend;
    tooltip: ApexTooltip;
    dataLabels: ApexDataLabels;
    plotOptions: ApexPlotOptions;
    fill: ApexFill;
    colors: string[];
  }> {
    return {
      series: this.chartSeries,
      chart: {
        type: 'donut',
        height: 160,
        width: 160,
        fontFamily: 'Sahel'
      },
      labels: this.chartLabels,
      colors: this.chartColors,
      legend: {
        show: true,
        position: 'bottom',
        fontSize: '12px',
        fontFamily: 'Sahel'
      },
      tooltip: {
        y: {
          formatter: val => `${val} ${this.tooltipSuffix}`
        }
      },
      dataLabels: {
        enabled: true,
        formatter: (val: number) => `${val.toFixed(0)}%`
      },
      plotOptions: {
        pie: {
          donut: {
            size: '75%',
            labels: {
              show: true,
              total: {
                show: true,
                label: this.totalLabel,
                formatter: () => `${this.totalCount}`
              }
            }
          }
        }
      },
      responsive: [
        {
          breakpoint: 480,
          options: {
            chart: {
              width: 200
            },
            legend: {
              position: 'bottom'
            }
          }
        }
      ]
    };
  }
}
