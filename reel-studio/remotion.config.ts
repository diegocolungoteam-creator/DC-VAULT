import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(false); // render to a new filename every time (guide §17)
Config.setConcurrency(2); // 8 GB Macs swap hard above this
Config.setEntryPoint('./src/index.ts');
