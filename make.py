import os
import time
import glob
from distutils.dir_util import copy_tree
import shutil

srcfiles = glob.glob('./src/backrooms/*.ts')
cmd = 'tsc --allowJs -m ES2020 -t ES2020 --outDir dist --sourceMap --alwaysStrict ' + " ".join(srcfiles) + ' ./src/lib/vue/vue.js '
print('Building TypeScript...', end='', flush=True)
start = time.time()
os.system(cmd)
copy_tree('./src/backrooms/static', './dist')
print('finished at ' + time.strftime('%H:%M:%S', time.localtime()) + ' (took ' + str(time.time() - start).split('.')[0] + 's)')
