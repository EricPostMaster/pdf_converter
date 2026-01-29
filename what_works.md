
This one seems to work the best for preprocessing

test_1
```
magick work/job-pages/page-3.png -colorspace Gray -normalize -contrast-stretch 1.5%x99.0% -statistic Median 3x3 -threshold 80% out.png
```

test_2
```
magick work/job-pages/page-3.png -colorspace Gray -gamma 0.2 -contrast-stretch 1.0%x90.0% -statistic Median 3x3 out.png
```

test_1 definitely seems to work better overall