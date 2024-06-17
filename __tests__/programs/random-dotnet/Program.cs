using System.Collections.Generic;
using System.Linq;
using Pulumi;
using Random = Pulumi.Random;

return await Deployment.RunAsync(() => 
{
    var username = new Random.RandomPassword("username", new()
    {
        Length = 256,
    });

});

