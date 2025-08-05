# OVERVIEW

## 📊 DrJava Insights CLI Tool

**[drjava-insights](https://www.npmjs.com/package/drjava-insights)** - A CLI tool for visualizing and replaying student coding sessions from DrJava IDE logs.

```bash
# Install globally
npm install -g drjava-insights

# Use with any DrJava log directory
drjava-insights /path/to/logs
```

See the [drjava-insights directory](./drjava-insights/) for more details.

---

This code base is merely a continuation of the DrJava code base formerly hosted
at Sourceforge. We decided to shift from Subversion to Git for two reasons:

1. Git is more flexible (and complex) than Subversion.
1. Second, and more importantly, Git appears to be the preferred repository and
   version control system among software developers and our upper level students
   are more familiar with Git than Subversion.

# Future Extensions

This repository also includes the unreleased pedagogic IDE
for Scala called DrScala, which we will release as soon as we can persuade the Scala developers
to fix a serious bug in the :require REPL command which we use to dynamically
add new paths to the REPL class path.

# Distribution of binaries

We will continue to distribute new releases of DrJava via Sourceforge to
preserve our distribution interface. The move from Subversion on Sourceforge
to Git on Github only concerns DrJava developers and others interested in the
DrJava code base.
