import os
import glob
from distutils.dir_util import copy_tree
import shutil

srcfiles = glob.glob('./src/backrooms/*.ts')
cmd = 'tsc --allowJs -m ES2020 -t ES2020 --outDir dist --sourceMap --alwaysStrict ' + " ".join(srcfiles) + ' ./src/lib/vue/vue.js '
print('Building TypeScript: ' + cmd)
os.system(cmd)
copy_tree('./src/backrooms/static', './dist')
